import { Window } from 'happy-dom';
import {
  bindingHandlers,
  getBindingHandler,
  enableNamespacedBindings,
  enableAutoNamespacedSyntax,
  addDefaultNamespacedBindingPreprocessor,
  autoNamespacedPreprocessor,
  defaultGetNamespacedHandler,
  Observable,
  applyBindings,
  BindingContext,
  addBindingPreprocessor,
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

describe('Namespaced Bindings', () => {
  // Enable namespaced bindings once for all tests
  beforeAll(() => {
    enableNamespacedBindings();
  });

  describe('enableNamespacedBindings (dynamic handler creation)', () => {
    afterEach(() => {
      delete bindingHandlers['attr.href'];
      delete bindingHandlers['attr.title'];
      delete bindingHandlers['css.active'];
      delete bindingHandlers['style.color'];
      delete bindingHandlers['event.click'];
    });

    it('creates a handler for attr.href on first lookup', () => {
      expect(bindingHandlers['attr.href']).toBeUndefined();
      const handler = getBindingHandler('attr.href');
      expect(handler).toBeDefined();
      expect(handler!.update).toBeDefined();
    });

    it('caches the created handler in bindingHandlers', () => {
      const handler = getBindingHandler('attr.href');
      expect(bindingHandlers['attr.href']).toBe(handler);
    });

    it('creates a handler for css.active', () => {
      const handler = getBindingHandler('css.active');
      expect(handler).toBeDefined();
      expect(handler!.update).toBeDefined();
    });

    it('creates a handler for style.color', () => {
      const handler = getBindingHandler('style.color');
      expect(handler).toBeDefined();
      expect(handler!.update).toBeDefined();
    });

    it('creates a handler for event.click with init', () => {
      const handler = getBindingHandler('event.click');
      expect(handler).toBeDefined();
      expect(handler!.init).toBeDefined();
      // event has init, not update
      expect(handler!.update).toBeUndefined();
    });

    it('returns undefined for unknown namespace', () => {
      expect(getBindingHandler('nonexistent.foo')).toBeUndefined();
    });

    it('returns undefined for non-namespaced unknown handlers', () => {
      expect(getBindingHandler('totallyUnknown')).toBeUndefined();
    });

    it('clears preprocess on generated handler', () => {
      // First add a preprocess to the attr handler
      const originalPreprocess = bindingHandlers['attr'].preprocess;
      bindingHandlers['attr'].preprocess = (v) => v;

      const handler = getBindingHandler('attr.href');
      expect(handler!.preprocess).toBeUndefined();

      bindingHandlers['attr'].preprocess = originalPreprocess;
    });
  });

  describe('defaultGetNamespacedHandler', () => {
    it('wraps update to translate single value to object map', () => {
      const updateSpy = jasmine.createSpy('update');
      const testHandler: BindingHandler = { update: updateSpy };

      const nsHandler = defaultGetNamespacedHandler.call(
        testHandler, 'myProp', 'testNs', 'testNs.myProp',
      );

      const fakeElement = document.createElement('div') as unknown as Node;
      const fakeVA = () => 'hello';
      const fakeBindings = { get: () => undefined, has: () => false };
      const ctx = new BindingContext({});

      // Simulate calling through the namespace handler
      bindingHandlers['testNs'] = testHandler;
      nsHandler.update!(fakeElement, fakeVA, fakeBindings, {}, ctx);

      expect(updateSpy).toHaveBeenCalled();
      const wrappedVA = updateSpy.calls.first().args[1];
      expect(wrappedVA()).toEqual({ myProp: 'hello' });

      delete bindingHandlers['testNs'];
    });

    it('wraps init to translate single value to object map', () => {
      const initSpy = jasmine.createSpy('init');
      const testHandler: BindingHandler = { init: initSpy };

      const nsHandler = defaultGetNamespacedHandler.call(
        testHandler, 'myEvent', 'testNs', 'testNs.myEvent',
      );

      const fakeElement = document.createElement('div') as unknown as Node;
      const fakeVA = () => () => {};
      const fakeBindings = { get: () => undefined, has: () => false };
      const ctx = new BindingContext({});

      bindingHandlers['testNs'] = testHandler;
      nsHandler.init!(fakeElement, fakeVA, fakeBindings, {}, ctx);

      expect(initSpy).toHaveBeenCalled();
      const wrappedVA = initSpy.calls.first().args[1];
      const result = wrappedVA();
      expect(result).toEqual({ myEvent: jasmine.any(Function) });

      delete bindingHandlers['testNs'];
    });

    it('does not create init wrapper if original has no init', () => {
      const testHandler: BindingHandler = { update() {} };
      const nsHandler = defaultGetNamespacedHandler.call(
        testHandler, 'x', 'ns', 'ns.x',
      );
      expect(nsHandler.init).toBeUndefined();
    });

    it('does not create update wrapper if original has no update', () => {
      const testHandler: BindingHandler = { init() {} };
      const nsHandler = defaultGetNamespacedHandler.call(
        testHandler, 'x', 'ns', 'ns.x',
      );
      expect(nsHandler.update).toBeUndefined();
    });
  });

  describe('autoNamespacedPreprocessor', () => {
    it('returns value unchanged when it does not start with {', () => {
      const result = autoNamespacedPreprocessor('someValue', 'attr', () => {});
      expect(result).toBe('someValue');
    });

    it('expands {key: val} to ns.key bindings', () => {
      const added: Array<{ key: string; val: string }> = [];
      const result = autoNamespacedPreprocessor(
        '{href: url, title: tip}',
        'attr',
        (key, val) => added.push({ key, val }),
      );

      expect(result).toBeUndefined();
      expect(added.length).toBe(2);
      expect(added[0]).toEqual({ key: 'attr.href', val: 'url' });
      expect(added[1]).toEqual({ key: 'attr.title', val: 'tip' });
    });

    it('expands single key', () => {
      const added: Array<{ key: string; val: string }> = [];
      autoNamespacedPreprocessor(
        '{active: isActive}',
        'css',
        (key, val) => added.push({ key, val }),
      );

      expect(added.length).toBe(1);
      expect(added[0]).toEqual({ key: 'css.active', val: 'isActive' });
    });
  });

  describe('enableAutoNamespacedSyntax', () => {
    const testKey = '__ns_auto_test_' + Date.now();

    afterEach(() => {
      delete bindingHandlers[testKey];
    });

    it('adds the auto-namespaced preprocessor to a handler', () => {
      bindingHandlers[testKey] = { update() {} };
      enableAutoNamespacedSyntax(testKey);

      const handler = getBindingHandler(testKey)!;
      expect(handler.preprocess).toBeDefined();

      // The preprocessor should pass through non-object values
      expect(handler.preprocess!('simpleValue', testKey, () => {})).toBe('simpleValue');
    });
  });

  describe('addDefaultNamespacedBindingPreprocessor', () => {
    let originalGetNamespacedHandler: BindingHandler['getNamespacedHandler'];

    beforeEach(() => {
      originalGetNamespacedHandler = bindingHandlers['attr'].getNamespacedHandler;
    });

    afterEach(() => {
      bindingHandlers['attr'].getNamespacedHandler = originalGetNamespacedHandler;
      delete bindingHandlers['attr.test_prop'];
    });

    it('applies a preprocessor to dynamically created namespaced handlers', () => {
      const spy = jasmine.createSpy('preprocessor').and.callFake((v: string) => v + '-modified');
      addDefaultNamespacedBindingPreprocessor('attr', spy);

      const handler = getBindingHandler('attr.test_prop');
      expect(handler).toBeDefined();
      expect(handler!.preprocess).toBeDefined();

      const result = handler!.preprocess!('original', 'attr.test_prop', () => {});
      expect(result).toBe('original-modified');
    });
  });

  describe('end-to-end with applyBindings', () => {
    let originalAttrPreprocess: BindingHandler['preprocess'];

    beforeEach(() => {
      originalAttrPreprocess = bindingHandlers['attr'].preprocess;
    });

    afterEach(() => {
      bindingHandlers['attr'].preprocess = originalAttrPreprocess;
      for (const key of Object.keys(bindingHandlers)) {
        if (key.includes('.') && !key.startsWith('__')) {
          delete bindingHandlers[key];
        }
      }
    });

    it('attr.title sets a title attribute', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', 'attr.title: tip');
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ tip: 'hello' }, container as unknown as Node);

      expect((inner as unknown as HTMLElement).getAttribute('title')).toBe('hello');
      container.remove();
    });

    it('attr.href is reactive', () => {
      const container = document.createElement('div');
      const inner = document.createElement('a');
      inner.setAttribute('data-bind', 'attr.href: url');
      container.appendChild(inner);
      document.body.appendChild(container);

      const url = new Observable('http://a.com');
      applyBindings({ url }, container as unknown as Node);

      expect((inner as unknown as HTMLAnchorElement).getAttribute('href')).toBe('http://a.com');
      url.set('http://b.com');
      expect((inner as unknown as HTMLAnchorElement).getAttribute('href')).toBe('http://b.com');

      container.remove();
    });

    it('css.active toggles a CSS class', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', 'css.active: isActive');
      container.appendChild(inner);
      document.body.appendChild(container);

      const isActive = new Observable(true);
      applyBindings({ isActive }, container as unknown as Node);

      expect((inner as unknown as HTMLElement).classList.contains('active')).toBe(true);
      isActive.set(false);
      expect((inner as unknown as HTMLElement).classList.contains('active')).toBe(false);

      container.remove();
    });

    it('style.color sets a style property', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', 'style.color: myColor');
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ myColor: 'red' }, container as unknown as Node);

      expect((inner as unknown as HTMLElement).style.color).toBe('red');
      container.remove();
    });

    it('event.click binds a click handler', () => {
      const container = document.createElement('div');
      const btn = document.createElement('button');
      btn.setAttribute('data-bind', 'event.click: onClick');
      container.appendChild(btn);
      document.body.appendChild(container);

      let clicked = false;
      applyBindings({ onClick: () => { clicked = true; } }, container as unknown as Node);

      btn.click();
      expect(clicked).toBe(true);

      container.remove();
    });

    it('supports multiple namespaced bindings on one element', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', 'attr.title: tip, css.highlight: isHighlighted');
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ tip: 'info', isHighlighted: true }, container as unknown as Node);

      expect((inner as unknown as HTMLElement).getAttribute('title')).toBe('info');
      expect((inner as unknown as HTMLElement).classList.contains('highlight')).toBe(true);

      container.remove();
    });

    it('auto-expand syntax works with enableAutoNamespacedSyntax', () => {
      enableAutoNamespacedSyntax('attr');

      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.setAttribute('data-bind', 'attr: {title: tip, id: myId}');
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ tip: 'hello', myId: 'test-id' }, container as unknown as Node);

      expect((inner as unknown as HTMLElement).getAttribute('title')).toBe('hello');
      expect((inner as unknown as HTMLElement).getAttribute('id')).toBe('test-id');

      container.remove();
    });
  });
});
