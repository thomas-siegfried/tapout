import { Window } from 'happy-dom';
import {
  filters,
  filterPreprocessor,
  enableTextFilter,
  bindingHandlers,
  getBindingHandler,
  Observable,
  applyBindings,
  enableInterpolationMarkup,
  bindingProviderInstance,
} from '#src/index.js';
import type { BindingHandler } from '#src/index.js';

const window = new Window();
const document = window.document;

describe('Filter/Pipe Syntax', () => {

  describe('filterPreprocessor', () => {
    it('returns input unchanged when no pipe is present', () => {
      expect(filterPreprocessor('name', 'text', () => {})).toBe('name');
    });

    it('preserves logical OR (||)', () => {
      const result = filterPreprocessor('a || b', 'text', () => {});
      // Whitespace is stripped by the tokenizer, but a||b is equivalent JS
      expect(result).toBe('a||b');
    });

    it('transforms a single filter', () => {
      const result = filterPreprocessor('name | uppercase', 'text', () => {});
      expect(result).toBe("$filters['uppercase'](name)");
    });

    it('transforms chained filters', () => {
      const result = filterPreprocessor('name | uppercase | lowercase', 'text', () => {});
      expect(result).toBe("$filters['lowercase']($filters['uppercase'](name))");
    });

    it('transforms filter with arguments', () => {
      const result = filterPreprocessor("bio | fit:100:'...'", 'text', () => {});
      expect(result).toBe("$filters['fit'](bio,100,'...')");
    });

    it('handles trailing colon (missing arg becomes undefined)', () => {
      const result = filterPreprocessor('x | fn:', 'text', () => {});
      expect(result).toBe("$filters['fn'](x,undefined)");
    });

    it('handles consecutive colons (missing middle arg)', () => {
      const result = filterPreprocessor('x | fn:a::b', 'text', () => {});
      expect(result).toBe("$filters['fn'](x,a,undefined,b)");
    });

    it('handles quoted strings containing pipe characters', () => {
      const result = filterPreprocessor("'a|b' | uppercase", 'text', () => {});
      expect(result).toBe("$filters['uppercase']('a|b')");
    });

    it('handles complex expressions before the pipe', () => {
      const result = filterPreprocessor('a() + b | uppercase', 'text', () => {});
      expect(result).toBe("$filters['uppercase'](a() + b)");
    });

    it('returns input when only || operators (no real pipes)', () => {
      const result = filterPreprocessor('a || b || c', 'text', () => {});
      expect(result).toBe('a||b||c');
    });
  });

  describe('enableTextFilter', () => {
    const testKey = '__filter_test_' + Date.now();

    afterEach(() => {
      delete bindingHandlers[testKey];
    });

    it('adds the filter preprocessor to a binding handler', () => {
      bindingHandlers[testKey] = { update() {} };
      enableTextFilter(testKey);

      const handler = getBindingHandler(testKey)!;
      expect(handler.preprocess).toBeDefined();

      const result = handler.preprocess!('name | uppercase', testKey, () => {});
      expect(result).toContain("$filters['uppercase']");
    });
  });

  describe('built-in filters', () => {

    describe('uppercase', () => {
      it('converts a string to uppercase', () => {
        expect(filters['uppercase']('hello')).toBe('HELLO');
      });

      it('unwraps observables', () => {
        const obs = new Observable('hello');
        expect(filters['uppercase'](obs)).toBe('HELLO');
      });

      it('handles null/undefined', () => {
        expect(filters['uppercase'](null)).toBe('');
        expect(filters['uppercase'](undefined)).toBe('');
      });
    });

    describe('lowercase', () => {
      it('converts a string to lowercase', () => {
        expect(filters['lowercase']('HELLO')).toBe('hello');
      });

      it('unwraps observables', () => {
        const obs = new Observable('HELLO');
        expect(filters['lowercase'](obs)).toBe('hello');
      });

      it('handles null/undefined', () => {
        expect(filters['lowercase'](null)).toBe('');
        expect(filters['lowercase'](undefined)).toBe('');
      });
    });

    describe('default', () => {
      it('returns the value when it is non-empty', () => {
        expect(filters['default']('hello', 'fallback')).toBe('hello');
      });

      it('returns the default for null', () => {
        expect(filters['default'](null, 'fallback')).toBe('fallback');
      });

      it('returns the default for undefined', () => {
        expect(filters['default'](undefined, 'fallback')).toBe('fallback');
      });

      it('returns the default for empty string', () => {
        expect(filters['default']('', 'fallback')).toBe('fallback');
      });

      it('returns the default for whitespace-only string', () => {
        expect(filters['default']('   ', 'fallback')).toBe('fallback');
      });

      it('returns the default for empty array', () => {
        expect(filters['default']([], 'fallback')).toBe('fallback');
      });

      it('returns the value for non-empty array', () => {
        expect(filters['default']([1, 2], 'fallback')).toEqual([1, 2]);
      });

      it('returns function values as-is (even if falsy not applicable)', () => {
        const fn = () => {};
        expect(filters['default'](fn, 'fallback')).toBe(fn);
      });

      it('returns zero as-is (not treated as empty)', () => {
        expect(filters['default'](0, 'fallback')).toBe(0);
      });

      it('returns false as-is', () => {
        expect(filters['default'](false, 'fallback')).toBe(false);
      });
    });

    describe('json', () => {
      it('converts an object to JSON', () => {
        const result = filters['json']({ name: 'Alice', age: 30 });
        const parsed = JSON.parse(result as string);
        expect(parsed).toEqual({ name: 'Alice', age: 30 });
      });

      it('converts with indentation', () => {
        const result = filters['json']({ a: 1 }, 2);
        expect(result).toContain('\n');
        expect(result).toContain('  ');
      });

      it('unwraps observables in the object', () => {
        const obs = new Observable('hello');
        const result = filters['json']({ value: obs });
        const parsed = JSON.parse(result as string);
        expect(parsed).toEqual({ value: 'hello' });
      });
    });
  });

  describe('custom filters', () => {
    afterEach(() => {
      delete filters['reverse'];
    });

    it('allows registering custom filters', () => {
      filters['reverse'] = (value: string) => value.split('').reverse().join('');
      expect(filters['reverse']('hello')).toBe('olleh');
    });
  });

  describe('end-to-end with applyBindings', () => {
    let originalTextPreprocess: BindingHandler['preprocess'];

    beforeEach(() => {
      originalTextPreprocess = bindingHandlers['text'].preprocess;
      enableTextFilter('text');
    });

    afterEach(() => {
      bindingHandlers['text'].preprocess = originalTextPreprocess;
    });

    it('applies uppercase filter in a text binding', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', 'text: name | uppercase');
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ name: 'alice' }, container as unknown as Node);

      expect(inner.textContent).toBe('ALICE');
      container.remove();
    });

    it('applies lowercase filter', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', 'text: name | lowercase');
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ name: 'ALICE' }, container as unknown as Node);

      expect(inner.textContent).toBe('alice');
      container.remove();
    });

    it('applies default filter', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', "text: name | default:'anonymous'");
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ name: null }, container as unknown as Node);

      expect(inner.textContent).toBe('anonymous');
      container.remove();
    });

    it('chains multiple filters', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', "text: name | default:'n/a' | uppercase");
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ name: null }, container as unknown as Node);

      expect(inner.textContent).toBe('N/A');
      container.remove();
    });

    it('works reactively with observables', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', 'text: name | uppercase');
      container.appendChild(inner);
      document.body.appendChild(container);

      const name = new Observable('alice');
      applyBindings({ name }, container as unknown as Node);

      expect(inner.textContent).toBe('ALICE');
      name.set('bob');
      expect(inner.textContent).toBe('BOB');

      container.remove();
    });

    it('applies json filter', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', 'text: data | json');
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ data: { x: 1 } }, container as unknown as Node);

      expect(JSON.parse(inner.textContent!)).toEqual({ x: 1 });
      container.remove();
    });
  });

  describe('end-to-end with interpolation markup', () => {
    let originalPreprocessNode: typeof bindingProviderInstance.preprocessNode;
    let originalTextPreprocess: BindingHandler['preprocess'];

    beforeEach(() => {
      originalPreprocessNode = bindingProviderInstance.preprocessNode;
      originalTextPreprocess = bindingHandlers['text'].preprocess;
      bindingProviderInstance.preprocessNode = undefined;
      enableInterpolationMarkup();
      enableTextFilter('text');
    });

    afterEach(() => {
      bindingProviderInstance.preprocessNode = originalPreprocessNode;
      bindingHandlers['text'].preprocess = originalTextPreprocess;
    });

    it('applies filters in {{ }} interpolation syntax', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.appendChild(document.createTextNode('{{ name | uppercase }}'));
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ name: 'alice' }, container as unknown as Node);

      expect(inner.textContent).toBe('ALICE');
      container.remove();
    });

    it('chains filters in interpolation', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.appendChild(document.createTextNode("{{ name | default:'n/a' | uppercase }}"));
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ name: '' }, container as unknown as Node);

      expect(inner.textContent).toBe('N/A');
      container.remove();
    });
  });
});
