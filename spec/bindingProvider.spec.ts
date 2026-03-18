import { Window } from 'happy-dom';
import {
  BindingProvider,
  BindingContext,
  Observable,
  bindingHandlers,
  getBindingHandler,
} from '#src/index.js';

const window = new Window();
const document = window.document;

function createElement(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  return el as unknown as Element;
}

function createComment(text: string): Comment {
  return document.createComment(text) as unknown as Comment;
}

describe('BindingProvider', () => {
  let provider: BindingProvider;

  beforeEach(() => {
    provider = new BindingProvider();
  });

  describe('nodeHasBindings', () => {
    it('returns true for elements with data-bind attribute', () => {
      const el = createElement('div', { 'data-bind': 'text: name' });
      expect(provider.nodeHasBindings(el)).toBe(true);
    });

    it('returns false for elements without data-bind attribute', () => {
      const el = createElement('div');
      expect(provider.nodeHasBindings(el)).toBe(false);
    });

    it('returns true for virtual element start comments', () => {
      const comment = createComment(' tap text: name ');
      expect(provider.nodeHasBindings(comment)).toBe(true);
    });

    it('returns false for regular comments', () => {
      const comment = createComment(' just a comment ');
      expect(provider.nodeHasBindings(comment)).toBe(false);
    });

    it('returns false for text nodes', () => {
      const text = document.createTextNode('hello') as unknown as Node;
      expect(provider.nodeHasBindings(text)).toBe(false);
    });
  });

  describe('getBindingsString', () => {
    it('reads data-bind attribute from elements', () => {
      const el = createElement('div', { 'data-bind': 'text: name' });
      expect(provider.getBindingsString(el)).toBe('text: name');
    });

    it('returns null for elements without data-bind', () => {
      const el = createElement('div');
      expect(provider.getBindingsString(el)).toBeNull();
    });

    it('reads binding value from virtual element comments', () => {
      const comment = createComment(' tap text: name ');
      expect(provider.getBindingsString(comment)).toBe('text: name');
    });

    it('returns null for non-virtual-element comments', () => {
      const comment = createComment(' not a binding ');
      expect(provider.getBindingsString(comment)).toBeNull();
    });

    it('returns null for text nodes', () => {
      const text = document.createTextNode('hello') as unknown as Node;
      expect(provider.getBindingsString(text)).toBeNull();
    });
  });

  describe('getBindingAccessors', () => {
    it('returns accessor functions for each binding', () => {
      const el = createElement('div', { 'data-bind': "text: name, visible: show" });
      const ctx = new BindingContext({ name: 'Alice', show: true });
      const accessors = provider.getBindingAccessors(el, ctx);

      expect(accessors).not.toBeNull();
      expect(typeof accessors!.text).toBe('function');
      expect(typeof accessors!.visible).toBe('function');
      expect(accessors!.text()).toBe('Alice');
      expect(accessors!.visible()).toBe(true);
    });

    it('returns null for nodes without bindings', () => {
      const el = createElement('div');
      const ctx = new BindingContext({});
      expect(provider.getBindingAccessors(el, ctx)).toBeNull();
    });

    it('resolves observable values through the context', () => {
      const name = new Observable('Bob');
      const el = createElement('div', { 'data-bind': 'text: name' });
      const ctx = new BindingContext({ name });
      const accessors = provider.getBindingAccessors(el, ctx);

      expect(accessors!.text()).toBe(name);
    });

    it('resolves $data, $parent, $root in bindings', () => {
      const rootVm = { title: 'Root' };
      const childVm = { title: 'Child' };
      const root = new BindingContext(rootVm);
      const child = root.createChildContext(childVm);

      const el = createElement('div', { 'data-bind': "text: $data.title, attr: { title: $parent.title }" });
      const accessors = provider.getBindingAccessors(el, child);

      expect(accessors!.text()).toBe('Child');
      const attrResult = accessors!.attr() as Record<string, string>;
      expect(attrResult.title).toBe('Root');
    });

    it('works with comment nodes', () => {
      const comment = createComment(' tap text: message ');
      const ctx = new BindingContext({ message: 'hello' });
      const accessors = provider.getBindingAccessors(comment, ctx);

      expect(accessors).not.toBeNull();
      expect(accessors!.text()).toBe('hello');
    });
  });

  describe('getBindings', () => {
    it('returns plain values (not wrapped in accessors)', () => {
      const el = createElement('div', { 'data-bind': 'text: name' });
      const ctx = new BindingContext({ name: 'Alice' });
      const bindings = provider.getBindings(el, ctx);

      expect(bindings).not.toBeNull();
      expect(bindings!.text).toBe('Alice');
    });
  });

  describe('parseBindingsString', () => {
    it('compiles and evaluates a binding string against a context', () => {
      const ctx = new BindingContext({ x: 42 });
      const el = createElement('div');
      const result = provider.parseBindingsString('value: x', ctx, el);

      expect(result).not.toBeNull();
      expect(result!.value).toBe(42);
    });

    it('throws with a helpful message on parse error', () => {
      const ctx = new BindingContext({});
      const el = createElement('div');
      expect(() => {
        provider.parseBindingsString('text: !!!invalid', ctx, el);
      }).toThrowError(/Unable to parse bindings/);
    });

    it('supports valueAccessors option', () => {
      const ctx = new BindingContext({ x: 42 });
      const el = createElement('div');
      const result = provider.parseBindingsString('value: x', ctx, el, { valueAccessors: true });

      expect(typeof result!.value).toBe('function');
      expect((result!.value as () => number)()).toBe(42);
    });
  });

  describe('binding cache', () => {
    it('caches compiled functions for the same binding string', () => {
      const ctx = new BindingContext({ x: 1 });
      const el = createElement('div');

      provider.parseBindingsString('text: x', ctx, el);
      const cacheKeys = Object.keys(provider.bindingCache);
      expect(cacheKeys.length).toBe(1);

      provider.parseBindingsString('text: x', ctx, el);
      expect(Object.keys(provider.bindingCache).length).toBe(1);
    });

    it('creates separate cache entries for valueAccessors vs plain', () => {
      const ctx = new BindingContext({ x: 1 });
      const el = createElement('div');

      provider.parseBindingsString('text: x', ctx, el);
      provider.parseBindingsString('text: x', ctx, el, { valueAccessors: true });

      expect(Object.keys(provider.bindingCache).length).toBe(2);
    });
  });

  describe('bindingHandlers registry', () => {
    const testKey = '__test_handler_' + Date.now();

    afterEach(() => {
      delete bindingHandlers[testKey];
    });

    it('can register and retrieve a binding handler', () => {
      const handler = { init() {} };
      bindingHandlers[testKey] = handler;
      expect(getBindingHandler(testKey)).toBe(handler);
    });

    it('returns undefined for unregistered handlers', () => {
      expect(getBindingHandler('__nonexistent__')).toBeUndefined();
    });
  });
});
