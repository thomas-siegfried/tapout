import { Window } from 'happy-dom';
import {
  applyBindings,
  bindingHandlers,
  allowedVirtualElementBindings,
  Observable,
  components,
  cleanNode,
  contextFor,
} from '#src/index.js';
import { runEarly } from '#src/tasks.js';

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

function createComment(text: string): Comment {
  return document.createComment(text) as unknown as Comment;
}

describe('component binding', () => {
  afterEach(() => {
    components._resetForTesting();
  });

  it('is registered as a handler', () => {
    expect(bindingHandlers['component']).toBeDefined();
    expect(bindingHandlers['component'].init).toBeDefined();
  });

  it('is allowed on virtual elements', () => {
    expect(allowedVirtualElementBindings['component']).toBe(true);
  });

  it('renders a synchronous component by name string', () => {
    components.register('test-widget', {
      template: '<span>Hello Component</span>',
      synchronous: true,
    });

    const el = createElement('div', { 'data-bind': "component: 'test-widget'" });
    document.body.appendChild(el as never);

    applyBindings({}, el);

    expect(el.innerHTML).toContain('Hello Component');
    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('renders a component with { name, params }', () => {
    components.register('greet', {
      template: '<span data-bind="text: $data.greeting"></span>',
      viewModel: {
        createViewModel(params: { greeting: string }) {
          return params;
        },
      },
      synchronous: true,
    });

    const el = createElement('div', { 'data-bind': "component: { name: 'greet', params: { greeting: 'Hi there' } }" });
    document.body.appendChild(el as never);

    applyBindings({}, el);

    expect(el.innerHTML).toContain('Hi there');
    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('exposes $component on the binding context', () => {
    const vm = { myProp: 42 };
    components.register('ctx-test', {
      template: '<span data-bind="text: $component.myProp"></span>',
      viewModel: { instance: vm },
      synchronous: true,
    });

    const el = createElement('div', { 'data-bind': "component: 'ctx-test'" });
    document.body.appendChild(el as never);

    applyBindings({}, el);

    expect(el.innerHTML).toContain('42');
    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('creates a template-only component (params become $data)', () => {
    components.register('tpl-only', {
      template: '<span data-bind="text: $data.msg"></span>',
      synchronous: true,
    });

    const el = createElement('div', { 'data-bind': "component: { name: 'tpl-only', params: { msg: 'no vm' } }" });
    document.body.appendChild(el as never);

    applyBindings({}, el);

    expect(el.innerHTML).toContain('no vm');
    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('passes $componentTemplateNodes to the component context', () => {
    components.register('slot-comp', {
      template: '<div class="wrapper" data-bind="foreach: $componentTemplateNodes"><span data-bind="text: $data.textContent"></span></div>',
      synchronous: true,
    });

    const el = createElement('div', { 'data-bind': "component: 'slot-comp'" },
      'Original child');
    document.body.appendChild(el as never);

    applyBindings({}, el);

    expect(el.innerHTML).toContain('Original child');
    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('disposes old viewmodel when re-rendering', () => {
    let disposeCount = 0;
    class DisposableVM {
      dispose() { disposeCount++; }
    }

    components.register('comp-a', {
      template: '<span>A</span>',
      viewModel: DisposableVM,
      synchronous: true,
    });
    components.register('comp-b', {
      template: '<span>B</span>',
      synchronous: true,
    });

    const name = new Observable('comp-a');
    const el = createElement('div', { 'data-bind': 'component: compName' });
    document.body.appendChild(el as never);

    applyBindings({ compName: name }, el);
    expect(el.innerHTML).toContain('A');
    expect(disposeCount).toBe(0);

    name.set('comp-b');

    expect(disposeCount).toBe(1);
    expect(el.innerHTML).toContain('B');

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('re-renders when the component name observable changes', () => {
    components.register('widget-a', {
      template: '<span>Widget A</span>',
      synchronous: true,
    });
    components.register('widget-b', {
      template: '<span>Widget B</span>',
      synchronous: true,
    });

    const name = new Observable('widget-a');
    const el = createElement('div', { 'data-bind': 'component: widgetName' });
    document.body.appendChild(el as never);

    applyBindings({ widgetName: name }, el);
    expect(el.innerHTML).toContain('Widget A');

    name.set('widget-b');
    expect(el.innerHTML).toContain('Widget B');

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('works with virtual element syntax', () => {
    components.register('ve-comp', {
      template: '<em>Virtual</em>',
      synchronous: true,
    });

    const container = createElement('div');
    const start = createComment(" tap component: 've-comp' ");
    const end = createComment(' /tap ');
    container.appendChild(start as never);
    container.appendChild(end as never);
    document.body.appendChild(container as never);

    applyBindings({}, container);

    expect(container.innerHTML).toContain('Virtual');
    cleanNode(container);
    document.body.removeChild(container as never);
  });

  it('throws if no component name is specified', () => {
    const el = createElement('div', { 'data-bind': "component: ''" });
    document.body.appendChild(el as never);

    expect(() => applyBindings({}, el)).toThrowError(/No component name specified/);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('empties the element immediately on init', () => {
    components.register('slow-comp', {
      template: '<span>loaded</span>',
      synchronous: true,
    });

    const el = createElement('div', {}, 'original content');
    document.body.appendChild(el as never);

    expect(el.textContent).toBe('original content');

    el.setAttribute('data-bind', "component: 'slow-comp'");
    applyBindings({}, el);

    // Original content replaced by the template
    expect(el.textContent).not.toBe('original content');
    expect(el.innerHTML).toContain('loaded');

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('disposes viewmodel when node is removed', () => {
    let disposed = false;
    components.register('dispose-test', {
      template: '<span>x</span>',
      viewModel: {
        createViewModel() {
          return { dispose() { disposed = true; } };
        },
      },
      synchronous: true,
    });

    const el = createElement('div', { 'data-bind': "component: 'dispose-test'" });
    document.body.appendChild(el as never);

    applyBindings({}, el);
    expect(disposed).toBe(false);

    cleanNode(el);
    expect(disposed).toBe(true);

    document.body.removeChild(el as never);
  });

  it('controls descendant bindings', () => {
    components.register('ctrl-desc', {
      template: '<span>controlled</span>',
      synchronous: true,
    });

    const el = createElement('div', { 'data-bind': "component: 'ctrl-desc'" },
      'this should be replaced');
    document.body.appendChild(el as never);

    applyBindings({}, el);

    expect(el.innerHTML).not.toContain('this should be replaced');
    expect(el.innerHTML).toContain('controlled');

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('applies bindings to the component template descendants', () => {
    const vm = { count: new Observable(5) };
    components.register('reactive-comp', {
      template: '<span data-bind="text: count"></span>',
      viewModel: { instance: vm },
      synchronous: true,
    });

    const el = createElement('div', { 'data-bind': "component: 'reactive-comp'" });
    document.body.appendChild(el as never);

    applyBindings({}, el);
    expect(el.textContent).toContain('5');

    vm.count.set(10);
    expect(el.textContent).toContain('10');

    cleanNode(el);
    document.body.removeChild(el as never);
  });
});
