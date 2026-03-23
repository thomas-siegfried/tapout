import { Window } from 'happy-dom';
import {
  reactive,
  components,
  applyBindings,
  cleanNode,
  component,
  options,
} from '#src/index.js';

const window = new Window();
const document = window.document;
(globalThis as Record<string, unknown>).document = document;

const defaultFactory = options.viewModelFactory;

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

describe('component lifecycle', () => {
  afterEach(() => {
    components._resetForTesting();
    options.viewModelFactory = defaultFactory;
  });

  describe('onInit', () => {
    it('is called after the VM is created', () => {
      let initCalled = false;

      components.register('init-basic', {
        template: '<span></span>',
        viewModel: {
          createViewModel() {
            return {
              onInit() { initCalled = true; },
            };
          },
        },
        synchronous: true,
      });

      const container = createElement('div');
      container.appendChild(createElement('init-basic') as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      expect(initCalled).toBe(true);

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('is called after wireParams so params are available', () => {
      let capturedName = '';

      @component({ tag: 'init-params', template: '<span></span>', synchronous: true })
      class InitParams {
        @reactive accessor name: string = '';

        onInit() {
          capturedName = this.name;
        }
      }

      class ParentVM {
        @reactive accessor parentName: string = 'Alice';
      }

      const parentVM = new ParentVM();

      const container = createElement('div');
      container.appendChild(createElement('init-params', { params: 'name: parentName' }) as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      expect(capturedName).toBe('Alice');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('runs before the template is bound (can set state for initial render)', () => {
      let boundValue = '';

      @component({ tag: 'init-before-bind', template: '<span data-bind="text: greeting"></span>', synchronous: true })
      class InitBeforeBind {
        @reactive accessor prefix: string = '';
        @reactive accessor greeting: string = '';

        onInit() {
          this.greeting = this.prefix + ' World';
        }
      }

      const container = createElement('div');
      container.appendChild(createElement('init-before-bind', { params: "prefix: 'Hello'" }) as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      const span = container.querySelector('span');
      boundValue = (span?.textContent || '').trim();
      expect(boundValue).toBe('Hello World');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('is not called if the VM does not define onInit', () => {
      let createCalled = false;

      components.register('no-init', {
        template: '<span></span>',
        viewModel: {
          createViewModel() {
            createCalled = true;
            return {};
          },
        },
        synchronous: true,
      });

      const container = createElement('div');
      container.appendChild(createElement('no-init') as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      expect(createCalled).toBe(true);

      cleanNode(container);
      document.body.removeChild(container as never);
    });
  });

  describe('lifecycle ordering', () => {
    it('calls onInit before onDescendantsComplete, and dispose on cleanup', () => {
      const order: string[] = [];

      @component({ tag: 'lifecycle-order', template: '<span></span>', synchronous: true })
      class LifecycleOrder {
        onInit() { order.push('onInit'); }
        onDescendantsComplete() { order.push('onDescendantsComplete'); }
        dispose() { order.push('dispose'); }
      }

      const container = createElement('div');
      container.appendChild(createElement('lifecycle-order') as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      expect(order).toEqual(['onInit', 'onDescendantsComplete']);

      cleanNode(container);

      expect(order).toEqual(['onInit', 'onDescendantsComplete', 'dispose']);

      document.body.removeChild(container as never);
    });
  });
});
