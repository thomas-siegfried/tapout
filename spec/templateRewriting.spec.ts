import { Window } from 'happy-dom';
import {
  memoization,
  memoizeBindingAttributeSyntax,
  ensureTemplateIsRewritten,
  applyMemoizedBindingsToNextSibling,
  bindingRewriteValidators,
  DomElementSource,
  BindingContext,
} from '#src/index.js';
import { TemplateEngine } from '#src/templateEngine.js';
import type { TemplateSource, TemplateRenderOptions } from '#src/templateEngine.js';

const window = new Window();
const document = window.document;

function createElement(tag: string, attrs: Record<string, string> = {}, html?: string): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  if (html !== undefined) {
    el.innerHTML = html;
  }
  return el as unknown as Element;
}

class MockTemplateEngine extends TemplateEngine {
  override allowTemplateRewriting = true;

  renderTemplateSource(
    _source: TemplateSource,
    _ctx: BindingContext,
    _opts: TemplateRenderOptions,
  ): Node[] {
    return [];
  }

  override createJavaScriptEvaluatorBlock(script: string): string {
    return '{{=' + script + '}}';
  }
}

describe('templateRewriting', () => {
  describe('memoizeBindingAttributeSyntax', () => {
    const engine = new MockTemplateEngine();

    it('replaces data-bind attributes with memoized evaluator blocks', () => {
      const html = '<div data-bind="text: name">content</div>';
      const result = memoizeBindingAttributeSyntax(html, engine);

      expect(result).not.toContain('data-bind');
      expect(result).toContain('{{=');
      expect(result).toContain('tap.__tr_ambtns');
      expect(result).toContain('<div');
      expect(result).toContain("'text':function(){return name }");
    });

    it('replaces virtual element comments (<!-- tap ... -->)', () => {
      const html = '<!-- tap text: name --><span></span><!-- /tap -->';
      const result = memoizeBindingAttributeSyntax(html, engine);

      expect(result).toContain('{{=');
      expect(result).toContain('tap.__tr_ambtns');
      expect(result).toContain("'#comment'");
      expect(result).toContain('<!-- tap -->');
    });

    it('handles multiple data-bind attributes in one string', () => {
      const html = '<span data-bind="text: a"></span><div data-bind="visible: b"></div>';
      const result = memoizeBindingAttributeSyntax(html, engine);

      expect(result).not.toContain('data-bind');
      const matches = result.match(/tap\.__tr_ambtns/g);
      expect(matches?.length).toBe(2);
    });

    it('preserves other attributes on elements', () => {
      const html = '<input class="foo" data-bind="value: x" id="bar" />';
      const result = memoizeBindingAttributeSyntax(html, engine);

      expect(result).toContain('class="foo"');
      expect(result).toContain('id="bar"');
      expect(result).not.toContain('data-bind');
    });

    it('returns unchanged HTML when no bindings are present', () => {
      const html = '<div class="plain">hello</div>';
      const result = memoizeBindingAttributeSyntax(html, engine);
      expect(result).toBe(html);
    });

    it('handles double-quoted data-bind values', () => {
      const html = '<div data-bind="text: name"></div>';
      const result = memoizeBindingAttributeSyntax(html, engine);
      expect(result).toContain('tap.__tr_ambtns');
    });

    it('handles single-quoted data-bind values', () => {
      const html = "<div data-bind='text: name'></div>";
      const result = memoizeBindingAttributeSyntax(html, engine);
      expect(result).toContain('tap.__tr_ambtns');
    });
  });

  describe('bindingRewriteValidators', () => {
    const engine = new MockTemplateEngine();

    afterEach(() => {
      delete bindingRewriteValidators['testBinding'];
    });

    it('throws when a binding is set to false (unsupported)', () => {
      bindingRewriteValidators['testBinding'] = false;
      const html = '<div data-bind="testBinding: val"></div>';
      expect(() => memoizeBindingAttributeSyntax(html, engine)).toThrowError(/does not support/);
    });

    it('throws when a validator function returns an error message', () => {
      bindingRewriteValidators['testBinding'] = () => 'custom error message';
      const html = '<div data-bind="testBinding: val"></div>';
      expect(() => memoizeBindingAttributeSyntax(html, engine)).toThrowError(/custom error message/);
    });

    it('allows binding when validator returns void', () => {
      bindingRewriteValidators['testBinding'] = () => { return; };
      const html = '<div data-bind="testBinding: val"></div>';
      expect(() => memoizeBindingAttributeSyntax(html, engine)).not.toThrow();
    });

    it('allows binding when validator is true', () => {
      bindingRewriteValidators['testBinding'] = true;
      const html = '<div data-bind="testBinding: val"></div>';
      expect(() => memoizeBindingAttributeSyntax(html, engine)).not.toThrow();
    });
  });

  describe('ensureTemplateIsRewritten', () => {
    it('rewrites template text via the engine', () => {
      const engine = new MockTemplateEngine();
      const scriptEl = createElement('script', { type: 'text/html', id: 'testTpl' });
      (scriptEl as HTMLScriptElement).text = '<div data-bind="text: name"></div>';
      document.body.appendChild(scriptEl as never);

      try {
        ensureTemplateIsRewritten('testTpl', engine, document as unknown as Document);

        const source = new DomElementSource(scriptEl);
        expect(source.text()).toContain('tap.__tr_ambtns');
        expect(source.text()).not.toContain('data-bind');
        expect(source.data('isRewritten')).toBeTruthy();
      } finally {
        document.body.removeChild(scriptEl as never);
      }
    });

    it('does not rewrite a second time', () => {
      const engine = new MockTemplateEngine();
      const scriptEl = createElement('script', { type: 'text/html', id: 'testTpl2' });
      const originalHtml = '<div data-bind="text: name"></div>';
      (scriptEl as HTMLScriptElement).text = originalHtml;
      document.body.appendChild(scriptEl as never);

      try {
        ensureTemplateIsRewritten('testTpl2', engine, document as unknown as Document);
        const firstRewrite = new DomElementSource(scriptEl).text();

        ensureTemplateIsRewritten('testTpl2', engine, document as unknown as Document);
        const secondRewrite = new DomElementSource(scriptEl).text();

        expect(firstRewrite).toBe(secondRewrite);
      } finally {
        document.body.removeChild(scriptEl as never);
      }
    });

    it('skips rewriting when allowTemplateRewriting is false', () => {
      const engine = new MockTemplateEngine();
      engine.allowTemplateRewriting = false;

      const scriptEl = createElement('script', { type: 'text/html', id: 'testTpl3' });
      const originalHtml = '<div data-bind="text: name"></div>';
      (scriptEl as HTMLScriptElement).text = originalHtml;
      document.body.appendChild(scriptEl as never);

      try {
        ensureTemplateIsRewritten('testTpl3', engine, document as unknown as Document);
        expect((scriptEl as HTMLScriptElement).text).toBe(originalHtml);
      } finally {
        document.body.removeChild(scriptEl as never);
      }
    });
  });

  describe('applyMemoizedBindingsToNextSibling', () => {
    it('returns a memoized comment string', () => {
      const bindingsFn = () => ({});
      const result = applyMemoizedBindingsToNextSibling(bindingsFn as never, 'div');
      expect(result).toMatch(/^<!--\[tap_memo:[0-9a-f]+\]-->$/);

      // Clean up the memo by providing a detached node (no nextSibling, so it's a no-op)
      const id = memoization.parseMemoText(result.replace('<!--', '').replace('-->', ''));
      const dummyNode = document.createComment('') as unknown as Comment;
      if (id) memoization.unmemoize(id, [dummyNode, new BindingContext({})]);
    });

    it('the memoized callback applies bindings to the next sibling', () => {
      let appliedToNode: Node | null = null;
      let appliedBindings: Record<string, () => unknown> | null = null;

      const bindingsFn = () => {
        const result = {
          text: () => 'hello',
        };
        appliedBindings = result;
        return result;
      };

      const result = applyMemoizedBindingsToNextSibling(bindingsFn as never, 'span');
      const id = memoization.parseMemoText(result.replace('<!--', '').replace('-->', ''))!;

      const container = createElement('div');
      const comment = document.createComment('memo placeholder') as unknown as Comment;
      const span = createElement('span');
      container.appendChild(comment as never);
      container.appendChild(span as never);

      const ctx = new BindingContext({});

      // Unmemoize calls the callback with (domNode, bindingContext)
      // The callback should find the next sibling and apply bindings
      memoization.unmemoize(id, [comment, ctx]);

      expect(appliedBindings).not.toBeNull();
    });

    it('does nothing if next sibling does not match nodeName', () => {
      const bindingsFn = jasmine.createSpy('bindingsFn').and.returnValue({});
      const result = applyMemoizedBindingsToNextSibling(bindingsFn as never, 'div');
      const id = memoization.parseMemoText(result.replace('<!--', '').replace('-->', ''))!;

      const container = createElement('div');
      const comment = document.createComment('memo') as unknown as Comment;
      const span = createElement('span'); // not a div
      container.appendChild(comment as never);
      container.appendChild(span as never);

      const ctx = new BindingContext({});
      memoization.unmemoize(id, [comment, ctx]);

      // bindings function should not have been called since 'span' !== 'div'
      expect(bindingsFn).not.toHaveBeenCalled();
    });
  });

  describe('TemplateEngine rewriting methods', () => {
    it('isTemplateRewritten returns true when allowTemplateRewriting is false', () => {
      const engine = new MockTemplateEngine();
      engine.allowTemplateRewriting = false;

      const scriptEl = createElement('script', { type: 'text/html', id: 'rw1' });
      document.body.appendChild(scriptEl as never);
      try {
        expect(engine.isTemplateRewritten('rw1', document as unknown as Document)).toBe(true);
      } finally {
        document.body.removeChild(scriptEl as never);
      }
    });

    it('isTemplateRewritten returns false for unrewritten template', () => {
      const engine = new MockTemplateEngine();
      const scriptEl = createElement('script', { type: 'text/html', id: 'rw2' });
      document.body.appendChild(scriptEl as never);
      try {
        expect(engine.isTemplateRewritten('rw2', document as unknown as Document)).toBe(false);
      } finally {
        document.body.removeChild(scriptEl as never);
      }
    });

    it('rewriteTemplate transforms the template text and marks as rewritten', () => {
      const engine = new MockTemplateEngine();
      const scriptEl = createElement('script', { type: 'text/html', id: 'rw3' });
      (scriptEl as HTMLScriptElement).text = 'original';
      document.body.appendChild(scriptEl as never);

      try {
        engine.rewriteTemplate('rw3', (text) => text.toUpperCase(), document as unknown as Document);

        const source = new DomElementSource(scriptEl);
        expect(source.text()).toBe('ORIGINAL');
        expect(source.data('isRewritten')).toBeTruthy();
        expect(engine.isTemplateRewritten('rw3', document as unknown as Document)).toBe(true);
      } finally {
        document.body.removeChild(scriptEl as never);
      }
    });

    it('createJavaScriptEvaluatorBlock throws on base TemplateEngine', () => {
      const engine = new MockTemplateEngine();
      // MockTemplateEngine overrides it, so test via a minimal subclass
      class BareEngine extends TemplateEngine {
        renderTemplateSource(): Node[] { return []; }
      }
      const bare = new BareEngine();
      expect(() => bare.createJavaScriptEvaluatorBlock('test')).toThrowError(/Override/);
    });
  });
});
