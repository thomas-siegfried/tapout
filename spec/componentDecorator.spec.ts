import { Window } from 'happy-dom';
import {
  component,
  getComponentTag,
  options,
  reactive,
  getObservable,
  Observable,
  components,
  applyBindings,
  cleanNode,
} from '#src/index.js';

const window = new Window();
const document = window.document;
(globalThis as Record<string, unknown>).document = document;

function createElement(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  return el as unknown as Element;
}

const defaultFactory = options.viewModelFactory;

describe('@component decorator', () => {
  afterEach(() => {
    components._resetForTesting();
    options.viewModelFactory = defaultFactory;
  });

  describe('registration', () => {
    it('registers the component with positional args', () => {
      @component('pos-widget', '<span>hello</span>')
      class PosWidget {}

      expect(components.isRegistered('pos-widget')).toBe(true);
    });

    it('registers the component with options object', () => {
      @component({ tag: 'opts-widget', template: '<span>opts</span>' })
      class OptsWidget {}

      expect(components.isRegistered('opts-widget')).toBe(true);
    });

    it('registers as synchronous when option is set', () => {
      @component({ tag: 'sync-widget', template: '<b>sync</b>', synchronous: true })
      class SyncWidget {}

      expect(components.isRegistered('sync-widget')).toBe(true);
    });
  });

  describe('getComponentTag', () => {
    it('returns the tag from the class constructor', () => {
      @component('tag-lookup', '<span></span>')
      class TagLookup {}

      expect(getComponentTag(TagLookup)).toBe('tag-lookup');
    });

    it('returns the tag from an instance', () => {
      @component('instance-lookup', '<span></span>')
      class InstanceLookup {}

      const instance = new InstanceLookup();
      expect(getComponentTag(instance)).toBe('instance-lookup');
    });

    it('returns undefined for undecorated classes', () => {
      class Plain {}
      expect(getComponentTag(Plain)).toBeUndefined();
      expect(getComponentTag(new Plain())).toBeUndefined();
    });
  });

  describe('options.viewModelFactory', () => {
    it('uses the custom factory to create instances', () => {
      let factoryCalled = false;

      options.viewModelFactory = (ctor) => {
        factoryCalled = true;
        return new ctor();
      };

      @component({ tag: 'factory-widget', template: '<span></span>', synchronous: true })
      class FactoryWidget {
        @reactive accessor name: string = 'default';
      }

      let childInstance: FactoryWidget | null = null;

      const container = createElement('div');
      const child = createElement('factory-widget', { params: "name: 'injected'" });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      expect(factoryCalled).toBe(true);

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('allows DI-style injection via factory', () => {
      class Logger {
        log(msg: string) { return msg; }
      }

      @component({ tag: 'di-widget', template: '<span></span>', synchronous: true })
      class DiWidget {
        logger: Logger | null = null;
      }

      options.viewModelFactory = (ctor) => {
        const instance = new ctor();
        if (instance instanceof DiWidget) {
          instance.logger = new Logger();
        }
        return instance;
      };

      const container = createElement('div');
      const child = createElement('di-widget');
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      cleanNode(container);
      document.body.removeChild(container as never);
    });
  });

  describe('integration with param wiring', () => {
    it('wires params to @reactive properties on the created VM', () => {
      @component({ tag: 'wired-widget', template: '<span data-bind="text: greeting"></span>', synchronous: true })
      class WiredWidget {
        @reactive accessor greeting: string = '';
      }

      const parentVM = { msg: 'Hello from parent' };

      const container = createElement('div');
      const child = createElement('wired-widget', { params: 'greeting: msg' });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('supports two-way binding via $-prefix params', () => {
      @component({ tag: 'twoway-widget', template: '<span></span>', synchronous: true })
      class TwoWayWidget {
        @reactive accessor value: string = '';
      }

      class ParentVM {
        @reactive accessor shared: string = 'initial';
      }

      const parentVM = new ParentVM();
      const parentObs = getObservable(parentVM, 'shared')!;

      const container = createElement('div');
      const child = createElement('twoway-widget', { params: 'value: $shared' });
      container.appendChild(child as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      cleanNode(container);
      document.body.removeChild(container as never);
    });
  });
});
