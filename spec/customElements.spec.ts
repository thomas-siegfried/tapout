import { Window } from 'happy-dom';
import {
  applyBindings,
  components,
  cleanNode,
  contextFor,
  Observable,
  getComponentNameForNode,
  BindingProvider,
  bindingProviderInstance,
  BindingContext,
} from '#src/index.js';

const window = new Window();
const document = window.document;
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

describe('getComponentNameForNode', () => {
  afterEach(() => {
    components._resetForTesting();
  });

  it('returns the tag name for a registered custom element with a hyphen', () => {
    components.register('my-widget', { template: '<span>w</span>', synchronous: true });
    const el = createElement('my-widget');
    expect(getComponentNameForNode(el)).toBe('my-widget');
  });

  it('returns undefined for unregistered elements', () => {
    const el = createElement('my-unregistered');
    expect(getComponentNameForNode(el)).toBeUndefined();
  });

  it('returns undefined for standard HTML elements even if registered', () => {
    // Standard elements like 'div' don't contain a hyphen and aren't HTMLUnknownElement
    components.register('div', { template: '<span>d</span>', synchronous: true });
    const el = createElement('div');
    expect(getComponentNameForNode(el)).toBeUndefined();
  });

  it('returns undefined for non-element nodes', () => {
    expect(getComponentNameForNode(document.createTextNode('text') as unknown as Node)).toBeUndefined();
    expect(getComponentNameForNode(document.createComment('comment') as unknown as Node)).toBeUndefined();
  });
});

describe('BindingProvider custom element integration', () => {
  afterEach(() => {
    components._resetForTesting();
  });

  it('nodeHasBindings returns true for custom elements matching registered components', () => {
    components.register('my-comp', { template: '<span>c</span>', synchronous: true });
    const el = createElement('my-comp');
    expect(bindingProviderInstance.nodeHasBindings(el)).toBe(true);
  });

  it('nodeHasBindings returns false for unregistered custom elements', () => {
    const el = createElement('unknown-comp');
    expect(bindingProviderInstance.nodeHasBindings(el)).toBe(false);
  });

  it('getBindingAccessors injects component binding for custom elements', () => {
    components.register('my-comp', { template: '<span>c</span>', synchronous: true });
    const el = createElement('my-comp');
    const ctx = new BindingContext({});
    const accessors = bindingProviderInstance.getBindingAccessors(el, ctx);
    expect(accessors).toBeTruthy();
    expect(accessors!['component']).toBeDefined();
    const value = (accessors!['component'] as () => unknown)();
    expect((value as { name: string }).name).toBe('my-comp');
  });

  it('throws if custom element also has an explicit component binding', () => {
    components.register('my-comp', { template: '<span>c</span>', synchronous: true });
    const el = createElement('my-comp', { 'data-bind': "component: 'other'" });
    const ctx = new BindingContext({});
    expect(() => {
      bindingProviderInstance.getBindingAccessors(el, ctx);
    }).toThrowError(/Cannot use the "component" binding on a custom element/);
  });
});

describe('Custom element rendering', () => {
  afterEach(() => {
    components._resetForTesting();
  });

  it('renders a custom element as a component', () => {
    components.register('hello-world', {
      template: '<span>Hello World</span>',
      synchronous: true,
    });

    const container = createElement('div');
    const el = createElement('hello-world');
    container.appendChild(el as never);
    document.body.appendChild(container as never);

    applyBindings({}, container);

    expect(el.innerHTML).toContain('Hello World');

    cleanNode(container);
    document.body.removeChild(container as never);
  });

  it('passes params attribute as component params', () => {
    components.register('greet-comp', {
      template: '<span data-bind="text: $data.message"></span>',
      synchronous: true,
    });

    const container = createElement('div');
    const el = createElement('greet-comp', { params: "message: 'Hi from params'" });
    container.appendChild(el as never);
    document.body.appendChild(container as never);

    applyBindings({}, container);

    expect(el.textContent).toContain('Hi from params');

    cleanNode(container);
    document.body.removeChild(container as never);
  });

  it('passes observable params with two-way unwrapping', () => {
    const name = new Observable('Alice');

    components.register('name-comp', {
      template: '<span data-bind="text: $data.who"></span>',
      synchronous: true,
    });

    const container = createElement('div');
    const el = createElement('name-comp', { params: 'who: theName' });
    container.appendChild(el as never);
    document.body.appendChild(container as never);

    applyBindings({ theName: name }, container);

    expect(el.textContent).toContain('Alice');

    name.set('Bob');
    expect(el.textContent).toContain('Bob');

    cleanNode(container);
    document.body.removeChild(container as never);
  });

  it('exposes $raw on params for access to outer observables', () => {
    const name = new Observable('Alice');
    let capturedRaw: Record<string, unknown> | undefined;

    components.register('raw-comp', {
      template: '<span></span>',
      viewModel: {
        createViewModel(params: Record<string, unknown>) {
          capturedRaw = params['$raw'] as Record<string, unknown>;
          return {};
        },
      },
      synchronous: true,
    });

    const container = createElement('div');
    const el = createElement('raw-comp', { params: 'who: theName' });
    container.appendChild(el as never);
    document.body.appendChild(container as never);

    applyBindings({ theName: name }, container);

    expect(capturedRaw).toBeDefined();
    expect(capturedRaw!['who']).toBeDefined();

    cleanNode(container);
    document.body.removeChild(container as never);
  });

  it('provides empty $raw when no params attribute is present', () => {
    let capturedParams: Record<string, unknown> | undefined;

    components.register('no-params-comp', {
      template: '<span></span>',
      viewModel: {
        createViewModel(params: Record<string, unknown>) {
          capturedParams = params;
          return {};
        },
      },
      synchronous: true,
    });

    const container = createElement('div');
    const el = createElement('no-params-comp');
    container.appendChild(el as never);
    document.body.appendChild(container as never);

    applyBindings({}, container);

    expect(capturedParams).toBeDefined();
    expect(capturedParams!['$raw']).toBeDefined();
    expect(Object.keys(capturedParams!['$raw'] as object).length).toBe(0);

    cleanNode(container);
    document.body.removeChild(container as never);
  });

  it('can combine custom element with other data-bind attributes on inner elements', () => {
    components.register('combo-comp', {
      template: '<div data-bind="text: $component.label"></div>',
      viewModel: { instance: { label: 'inner label' } },
      synchronous: true,
    });

    const container = createElement('div');
    const el = createElement('combo-comp');
    container.appendChild(el as never);
    document.body.appendChild(container as never);

    applyBindings({}, container);

    expect(el.textContent).toContain('inner label');

    cleanNode(container);
    document.body.removeChild(container as never);
  });
});
