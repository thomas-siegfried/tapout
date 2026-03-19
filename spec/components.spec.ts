import { Window } from 'happy-dom';
import * as components from '#src/components.js';
import { runEarly, resetForTesting as resetTasks } from '#src/tasks.js';

const window = new Window();
const document = window.document;

// Make document available globally for parseHtmlFragment
(globalThis as Record<string, unknown>).document = document;

function createElement(tag: string, attrs: Record<string, string> = {}, ...children: (Node | string)[]): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child) as never);
    } else {
      el.appendChild(child as never);
    }
  }
  return el as unknown as Element;
}

function resetAll() {
  components._resetForTesting();
  resetTasks();
}

describe('Component Registration', () => {
  afterEach(resetAll);

  it('registers a component', () => {
    components.register('test-comp', { template: '<div>hello</div>' });
    expect(components.isRegistered('test-comp')).toBe(true);
  });

  it('throws on registering with falsy config', () => {
    expect(() => components.register('test-comp', null as never)).toThrowError(/Invalid configuration/);
  });

  it('throws on duplicate registration', () => {
    components.register('test-comp', { template: '<div>hello</div>' });
    expect(() => components.register('test-comp', { template: '<div>hello</div>' })).toThrowError(/already registered/);
  });

  it('unregisters a component', () => {
    components.register('test-comp', { template: '<div>hello</div>' });
    components.unregister('test-comp');
    expect(components.isRegistered('test-comp')).toBe(false);
  });

  it('isRegistered returns false for unknown names', () => {
    expect(components.isRegistered('nonexistent')).toBe(false);
  });

  it('clearCachedDefinition removes cached definition', () => {
    components.register('test-comp', { template: '<div>hello</div>', synchronous: true });

    let def1: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { def1 = d; });
    runEarly();
    expect(def1).toBeTruthy();

    components.clearCachedDefinition('test-comp');

    let def2: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { def2 = d; });
    // After clearCachedDefinition, next get for a synchronous component still
    // needs to reload, which triggers schedule() since it hasn't cached yet.
    // But the config still has synchronous: true, so after reloading it
    // should fire synchronously on the second get (from cache).
    expect(def2).toBeTruthy();
    expect(def2).not.toBe(def1);
  });
});

describe('Component Loader Pipeline', () => {
  afterEach(() => {
    resetAll();
    components.loaders.length = 0;
    components.loaders.push(components.defaultLoader);
  });

  it('get() retrieves a registered component (synchronous config)', () => {
    components.register('test-comp', { template: '<div>hello</div>', synchronous: true });
    let result: components.ComponentDefinition | null = null;

    components.get('test-comp', (definition) => {
      result = definition;
    });

    expect(result).toBeTruthy();
    expect(result!.template).toBeDefined();
  });

  it('get() delivers asynchronously for non-synchronous components', () => {
    components.register('test-comp', { template: '<div>hello</div>' });
    let result: components.ComponentDefinition | null = null;

    components.get('test-comp', (definition) => {
      result = definition;
    });

    // Not yet delivered
    expect(result).toBeNull();

    // Process the scheduled task
    runEarly();

    expect(result).toBeTruthy();
    expect(result!.template).toBeDefined();
  });

  it('cached synchronous components deliver synchronously on subsequent gets', () => {
    components.register('test-comp', { template: '<div>hi</div>', synchronous: true });

    // First call loads and caches synchronously
    let firstResult: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { firstResult = d; });
    expect(firstResult).toBeTruthy();

    // Second call delivers from cache synchronously
    let secondResult: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { secondResult = d; });
    expect(secondResult).toBeTruthy();
    expect(secondResult).toBe(firstResult);
  });

  it('get() returns null definition for unknown components', () => {
    let result: unknown = 'not-called';
    components.get('unknown-comp', (definition) => {
      result = definition;
    });
    runEarly();
    expect(result).toBeNull();
  });

  it('deduplicates concurrent loads for the same component', () => {
    let getConfigCalls = 0;
    const customLoader: components.ComponentLoader = {
      getConfig(name, callback) {
        getConfigCalls++;
        callback({ template: '<span>loaded</span>', synchronous: true });
      },
    };
    components.loaders.unshift(customLoader);

    let first: components.ComponentDefinition | null = null;
    let second: components.ComponentDefinition | null = null;

    components.get('test-comp', (d) => { first = d; });
    components.get('test-comp', (d) => { second = d; });

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(getConfigCalls).toBe(1);
  });

  it('supports custom loaders before the default loader', () => {
    const customLoader: components.ComponentLoader = {
      getConfig(name, callback) {
        if (name === 'test-comp') {
          callback({ template: '<span>custom</span>', synchronous: true });
        } else {
          callback(null);
        }
      },
    };
    components.loaders.unshift(customLoader);

    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result).toBeTruthy();
    expect(result!.template).toBeDefined();
  });

  it('falls through loaders when result is null', () => {
    const emptyLoader: components.ComponentLoader = {
      getConfig(_name, callback) {
        callback(null);
      },
    };
    components.loaders.unshift(emptyLoader);

    components.register('test-comp', { template: '<div>fallback</div>', synchronous: true });

    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result).toBeTruthy();
  });

  it('throws if a loader returns synchronously', () => {
    const badLoader: components.ComponentLoader = {
      getConfig(_name, _callback) {
        return 'bad' as never;
      },
    };
    components.loaders.unshift(badLoader);

    expect(() => {
      components.get('test-comp', () => {});
    }).toThrowError(/must supply values by invoking the callback/);
  });
});

describe('Template Resolution', () => {
  afterEach(resetAll);

  it('resolves a string template to DOM nodes', () => {
    components.register('test-comp', { template: '<div>hello</div>', synchronous: true });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result).toBeTruthy();
    expect(result!.template).toBeDefined();
    expect(result!.template!.length).toBeGreaterThan(0);
    expect((result!.template![0] as Element).tagName?.toLowerCase()).toBe('div');
  });

  it('resolves an array of DOM nodes as template', () => {
    const nodes = [createElement('span')];
    components.register('test-comp', { template: nodes, synchronous: true });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result!.template).toBe(nodes);
  });

  it('resolves a DocumentFragment as template', () => {
    const frag = document.createDocumentFragment() as unknown as DocumentFragment;
    frag.appendChild(document.createElement('p') as never);
    components.register('test-comp', { template: frag, synchronous: true });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result!.template).toBeDefined();
    expect(result!.template!.length).toBe(1);
  });

  it('resolves { element: string } template by ID', () => {
    // Use globalThis.document to ensure getElementById will find it
    const doc = globalThis.document as Document;
    const templateEl = doc.createElement('script') as HTMLScriptElement;
    templateEl.setAttribute('type', 'text/html');
    templateEl.id = 'tpl-test';
    templateEl.text = '<span>from script</span>';
    doc.body.appendChild(templateEl);

    components.register('test-comp', { template: { element: 'tpl-test' }, synchronous: true });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result!.template).toBeDefined();
    expect(result!.template!.length).toBeGreaterThan(0);
    doc.body.removeChild(templateEl);
  });

  it('resolves { element: DOMElement } template', () => {
    const el = createElement('div', {}, 'child text');
    components.register('test-comp', { template: { element: el }, synchronous: true });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result!.template).toBeDefined();
    expect(result!.template!.length).toBeGreaterThan(0);
  });

  it('throws for unknown template value', () => {
    components.register('test-comp', { template: 42 as never, synchronous: true });
    expect(() => {
      components.get('test-comp', () => {});
    }).toThrowError(/Unknown template value/);
  });

  it('throws for element not found by ID', () => {
    components.register('test-comp', { template: { element: 'nonexistent-id' }, synchronous: true });
    expect(() => {
      components.get('test-comp', () => {});
    }).toThrowError(/Cannot find element with ID/);
  });
});

describe('ViewModel Resolution', () => {
  afterEach(resetAll);

  it('wraps a constructor function', () => {
    class MyVM {
      params: unknown;
      constructor(params: unknown) { this.params = params; }
    }
    components.register('test-comp', { template: '<div></div>', viewModel: MyVM, synchronous: true });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result!.createViewModel).toBeDefined();
    const vm = result!.createViewModel!({ foo: 1 }, null as never);
    expect(vm).toBeInstanceOf(MyVM);
    expect((vm as MyVM).params).toEqual({ foo: 1 });
  });

  it('uses createViewModel factory as-is', () => {
    const factory = (params: unknown) => ({ custom: true, params });
    components.register('test-comp', {
      template: '<div></div>',
      viewModel: { createViewModel: factory },
      synchronous: true,
    });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result!.createViewModel).toBe(factory);
  });

  it('handles { instance: obj } config', () => {
    const fixedVM = { name: 'fixed' };
    components.register('test-comp', {
      template: '<div></div>',
      viewModel: { instance: fixedVM },
      synchronous: true,
    });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    const vm = result!.createViewModel!(null, null as never);
    expect(vm).toBe(fixedVM);
  });

  it('resolves nested { viewModel: ... } config', () => {
    class Inner {
      x: number;
      constructor() { this.x = 99; }
    }
    components.register('test-comp', {
      template: '<div></div>',
      viewModel: { viewModel: Inner },
      synchronous: true,
    });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    const vm = result!.createViewModel!({}, null as never);
    expect(vm).toBeInstanceOf(Inner);
  });

  it('creates template-only components (no viewModel)', () => {
    components.register('test-comp', { template: '<div>no vm</div>', synchronous: true });
    let result: components.ComponentDefinition | null = null;
    components.get('test-comp', (d) => { result = d; });
    expect(result!.template).toBeDefined();
    expect(result!.createViewModel).toBeUndefined();
  });

  it('throws for unknown viewModel value', () => {
    components.register('test-comp', {
      template: '<div></div>',
      viewModel: 'bad' as never,
      synchronous: true,
    });
    expect(() => {
      components.get('test-comp', () => {});
    }).toThrowError(/Unknown viewModel value/);
  });
});
