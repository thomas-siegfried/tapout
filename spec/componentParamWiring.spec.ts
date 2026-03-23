import { Window } from 'happy-dom';
import {
  applyBindings,
  reactive,
  reactiveArray,
  getObservable,
  Observable,
  ObservableArray,
  components,
  cleanNode,
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

describe('component param wiring', () => {
  afterEach(() => {
    components._resetForTesting();
  });

  describe('wireParams integration with component binding', () => {
    it('wires plain value params to @reactive properties', () => {
      class ChildVM {
        @reactive accessor greeting: string = '';
      }

      let childInstance: ChildVM | null = null;

      components.register('plain-child', {
        template: '<span data-bind="text: greeting"></span>',
        viewModel: {
          createViewModel(params: unknown) {
            childInstance = new ChildVM();
            return childInstance;
          },
        },
        synchronous: true,
      });

      const parentVM = { msg: 'Hello World' };
      const container = createElement('div');
      const child = createElement('plain-child', { params: 'greeting: msg' });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      expect(childInstance).not.toBeNull();
      expect(childInstance!.greeting).toBe('Hello World');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('wires reactive parent params (one-way via Computed)', () => {
      class ChildVM {
        @reactive accessor label: string = '';
      }

      let childInstance: ChildVM | null = null;

      components.register('oneway-child', {
        template: '<span data-bind="text: label"></span>',
        viewModel: {
          createViewModel() {
            childInstance = new ChildVM();
            return childInstance;
          },
        },
        synchronous: true,
      });

      class ParentVM {
        @reactive accessor parentLabel: string = 'Initial';
      }
      const parentVM = new ParentVM();

      const container = createElement('div');
      const child = createElement('oneway-child', { params: 'label: parentLabel' });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      expect(childInstance).not.toBeNull();
      expect(childInstance!.label).toBe('Initial');

      parentVM.parentLabel = 'Updated';
      expect(childInstance!.label).toBe('Updated');

      cleanNode(container);
      document.body.removeChild(container as never);
    });
  });

  describe('$-prefix observable params', () => {
    it('passes the raw Observable when $ prefix is used', () => {
      class ChildVM {
        @reactive accessor name: string = '';
      }

      let childInstance: ChildVM | null = null;

      components.register('shared-child', {
        template: '<span data-bind="text: name"></span>',
        viewModel: {
          createViewModel() {
            childInstance = new ChildVM();
            return childInstance;
          },
        },
        synchronous: true,
      });

      class ParentVM {
        @reactive accessor parentName: string = 'Alice';
      }
      const parentVM = new ParentVM();
      const parentObs = getObservable(parentVM, 'parentName')!;

      const container = createElement('div');
      const child = createElement('shared-child', { params: 'name: $parentName' });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      expect(childInstance).not.toBeNull();
      expect(childInstance!.name).toBe('Alice');
      expect(getObservable(childInstance!, 'name')).toBe(parentObs);

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('enables two-way binding — parent changes update child', () => {
      class ChildVM {
        @reactive accessor value: string = '';
      }

      let childInstance: ChildVM | null = null;

      components.register('twoway-child', {
        template: '<span></span>',
        viewModel: {
          createViewModel() {
            childInstance = new ChildVM();
            return childInstance;
          },
        },
        synchronous: true,
      });

      class ParentVM {
        @reactive accessor sharedVal: string = 'start';
      }
      const parentVM = new ParentVM();

      const container = createElement('div');
      const child = createElement('twoway-child', { params: 'value: $sharedVal' });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      parentVM.sharedVal = 'from parent';
      expect(childInstance!.value).toBe('from parent');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('enables two-way binding — child changes update parent', () => {
      class ChildVM {
        @reactive accessor value: string = '';
      }

      let childInstance: ChildVM | null = null;

      components.register('twoway-child2', {
        template: '<span></span>',
        viewModel: {
          createViewModel() {
            childInstance = new ChildVM();
            return childInstance;
          },
        },
        synchronous: true,
      });

      class ParentVM {
        @reactive accessor sharedVal: string = 'start';
      }
      const parentVM = new ParentVM();

      const container = createElement('div');
      const child = createElement('twoway-child2', { params: 'value: $sharedVal' });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      childInstance!.value = 'from child';
      expect(parentVM.sharedVal).toBe('from child');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('does not treat known context keywords as observable refs', () => {
      components.register('ctx-child', {
        template: '<span data-bind="text: $data.name"></span>',
        viewModel: {
          createViewModel(params: Record<string, unknown>) {
            return params;
          },
        },
        synchronous: true,
      });

      const parentVM = { $data: { name: 'from context' } };

      const container = createElement('div');
      const child = createElement('ctx-child', { params: 'name: $data.name' });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      // $data is a context keyword, so this should be treated as a normal expression
      // not as an observable ref lookup. It won't match OBSERVABLE_REF_PATTERN because of the dot.
      applyBindings(parentVM, container);

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('mixes normal and $-prefixed params', () => {
      class ChildVM {
        @reactive accessor title: string = '';
        @reactive accessor count: number = 0;
      }

      let childInstance: ChildVM | null = null;

      components.register('mixed-child', {
        template: '<span></span>',
        viewModel: {
          createViewModel() {
            childInstance = new ChildVM();
            return childInstance;
          },
        },
        synchronous: true,
      });

      class ParentVM {
        @reactive accessor parentCount: number = 42;
      }
      const parentVM = new ParentVM();
      const parentCountObs = getObservable(parentVM, 'parentCount')!;

      const container = createElement('div');
      const child = createElement('mixed-child', { params: "title: 'Static Title', count: $parentCount" });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      expect(childInstance).not.toBeNull();
      expect(childInstance!.title).toBe('Static Title');
      expect(childInstance!.count).toBe(42);
      expect(getObservable(childInstance!, 'count')).toBe(parentCountObs);

      cleanNode(container);
      document.body.removeChild(container as never);
    });
  });
});
