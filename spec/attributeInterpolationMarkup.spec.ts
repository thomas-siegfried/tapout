import { Window } from 'happy-dom';
import {
  attributeBinding,
  attributeInterpolationMarkupPreprocessor,
  enableAttributeInterpolationMarkup,
  bindingProviderInstance,
  bindingHandlers,
  getBindingHandler,
  Observable,
  applyBindings,
} from '#src/index.js';
import type { BindingHandler } from '#src/index.js';

const window = new Window();
const document = window.document;

function createElement(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  return el as unknown as Element;
}

describe('Attribute Interpolation Markup', () => {

  describe('attributeBinding', () => {
    it('returns the direct binding name when a handler exists', () => {
      expect(getBindingHandler('visible')).toBeDefined();
      const result = attributeBinding('visible', 'show', createElement('div'));
      expect(result).toBe('visible:show');
    });

    it('falls back to attr.name when no handler exists', () => {
      expect(getBindingHandler('title')).toBeUndefined();
      const result = attributeBinding('title', 'tip', createElement('div'));
      expect(result).toBe('attr.title:tip');
    });

    it('uses direct binding for class', () => {
      expect(getBindingHandler('class')).toBeDefined();
      const result = attributeBinding('class', 'cls', createElement('div'));
      expect(result).toBe('class:cls');
    });

    it('uses direct binding for style', () => {
      expect(getBindingHandler('style')).toBeDefined();
      const result = attributeBinding('style', 's', createElement('div'));
      expect(result).toBe('style:s');
    });

    it('uses direct binding for value', () => {
      expect(getBindingHandler('value')).toBeDefined();
      const result = attributeBinding('value', 'v', createElement('input'));
      expect(result).toBe('value:v');
    });
  });

  describe('attributeInterpolationMarkupPreprocessor', () => {
    it('returns undefined for non-element nodes', () => {
      const text = document.createTextNode('hello') as unknown as Node;
      expect(attributeInterpolationMarkupPreprocessor(text)).toBeUndefined();
    });

    it('returns undefined for elements without {{ }} attributes', () => {
      const el = createElement('div', { class: 'plain', title: 'no interpolation' });
      expect(attributeInterpolationMarkupPreprocessor(el as unknown as Node)).toBeUndefined();
    });

    it('converts a single-expression attribute to a data-bind', () => {
      const el = createElement('div', { title: '{{ tooltip }}' });
      attributeInterpolationMarkupPreprocessor(el as unknown as Node);

      expect(el.getAttribute('data-bind')).toContain('title');
      expect(el.getAttribute('data-bind')).toContain('tooltip');
      expect(el.hasAttribute('title')).toBe(false);
    });

    it('converts a concatenated attribute to a data-bind with $unwrap', () => {
      const el = createElement('div', { title: 'Hello {{ name }}!' });
      attributeInterpolationMarkupPreprocessor(el as unknown as Node);

      const binding = el.getAttribute('data-bind')!;
      expect(binding).toContain('$unwrap');
      expect(binding).toContain('"Hello "');
      expect(binding).toContain('"!"');
      expect(binding).toContain('name');
      expect(el.hasAttribute('title')).toBe(false);
    });

    it('preserves existing data-bind and appends new bindings', () => {
      const el = createElement('div', {
        'data-bind': 'text: message',
        title: '{{ tooltip }}',
      });
      attributeInterpolationMarkupPreprocessor(el as unknown as Node);

      const binding = el.getAttribute('data-bind')!;
      expect(binding).toContain('text: message');
      expect(binding).toContain('tooltip');
    });

    it('handles multiple attributes with interpolation', () => {
      const el = createElement('div', {
        title: '{{ tip }}',
        id: '{{ myId }}',
      });
      attributeInterpolationMarkupPreprocessor(el as unknown as Node);

      const binding = el.getAttribute('data-bind')!;
      expect(binding).toContain('tip');
      expect(binding).toContain('myId');
    });

    it('skips the data-bind attribute itself', () => {
      const el = createElement('div', {
        'data-bind': 'text: {{ name }}',
      });
      attributeInterpolationMarkupPreprocessor(el as unknown as Node);

      // data-bind should be untouched (no extra processing)
      expect(el.getAttribute('data-bind')).toBe('text: {{ name }}');
    });

    it('lowercases attribute names', () => {
      const el = document.createElement('div');
      el.setAttribute('TITLE', '{{ tip }}');
      attributeInterpolationMarkupPreprocessor(el as unknown as Node);

      const binding = el.getAttribute('data-bind')!;
      expect(binding).toContain('title');
    });

    it('escapes double quotes in text parts', () => {
      const el = createElement('div', { title: 'say "{{ word }}"' });
      attributeInterpolationMarkupPreprocessor(el as unknown as Node);

      const binding = el.getAttribute('data-bind')!;
      expect(binding).toContain('\\"');
    });

    it('uses direct binding for known handler attributes', () => {
      const el = createElement('div', { visible: '{{ show }}' });
      attributeInterpolationMarkupPreprocessor(el as unknown as Node);

      const binding = el.getAttribute('data-bind')!;
      expect(binding).toContain('visible:');
      expect(binding).toContain('show');
      expect(binding).not.toContain('attr.');
    });

    it('uses attr.name for unknown attributes', () => {
      const el = createElement('div', { 'data-custom': '{{ val }}' });
      attributeInterpolationMarkupPreprocessor(el as unknown as Node);

      const binding = el.getAttribute('data-bind')!;
      expect(binding).toContain('attr.data-custom');
    });
  });

  describe('end-to-end with applyBindings', () => {
    let originalPreprocessNode: typeof bindingProviderInstance.preprocessNode;

    beforeEach(() => {
      originalPreprocessNode = bindingProviderInstance.preprocessNode;
      bindingProviderInstance.preprocessNode = undefined;
      enableAttributeInterpolationMarkup();
    });

    afterEach(() => {
      bindingProviderInstance.preprocessNode = originalPreprocessNode;
    });

    it('binds a single-expression attribute using a known handler', () => {
      const container = document.createElement('div');
      const inner = document.createElement('div');
      inner.setAttribute('visible', '{{ show }}');
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ show: true }, container as unknown as Node);

      expect((inner as unknown as HTMLElement).style.display).not.toBe('none');
      container.remove();
    });

    it('reactively updates known handler attributes', () => {
      const container = document.createElement('div');
      const inner = document.createElement('div');
      inner.setAttribute('visible', '{{ show }}');
      container.appendChild(inner);
      document.body.appendChild(container);

      const show = new Observable(true);
      applyBindings({ show }, container as unknown as Node);

      expect((inner as unknown as HTMLElement).style.display).not.toBe('none');
      show.set(false);
      expect((inner as unknown as HTMLElement).style.display).toBe('none');

      container.remove();
    });

    it('uses $unwrap for concatenated expressions', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('class', 'item-{{ type }}');
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ type: 'active' }, container as unknown as Node);

      expect((inner as unknown as HTMLElement).className).toBe('item-active');
      container.remove();
    });

    it('unwraps observables in concatenated expressions', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('class', 'item-{{ type }}');
      container.appendChild(inner);
      document.body.appendChild(container);

      const type = new Observable('active');
      applyBindings({ type }, container as unknown as Node);

      expect((inner as unknown as HTMLElement).className).toBe('item-active');
      type.set('disabled');
      expect((inner as unknown as HTMLElement).className).toBe('item-disabled');

      container.remove();
    });
  });
});
