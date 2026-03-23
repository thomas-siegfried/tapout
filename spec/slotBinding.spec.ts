import { Window } from 'happy-dom';
import {
  reactive,
  components,
  applyBindings,
  cleanNode,
  component,
  options,
} from '#src/index.js';
import { _resetFactoryForTesting } from '#src/componentDecorator.js';

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

function textOf(el: Element): string {
  return (el.textContent || '').trim();
}

describe('slot binding', () => {
  afterEach(() => {
    components._resetForTesting();
    options.viewModelFactory = defaultFactory;
  });

  describe('default slot', () => {
    it('injects inner HTML into a default slot element', () => {
      components.register('card-default', {
        template: '<div class="card"><div data-bind="slot"></div></div>',
        viewModel: { createViewModel() { return {}; } },
        synchronous: true,
      });

      const container = createElement('div');
      const card = createElement('card-default');
      card.appendChild(createElement('p', {}, 'Injected content') as never);
      container.appendChild(card as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      const slotDiv = container.querySelector('.card div');
      expect(slotDiv).not.toBeNull();
      expect(textOf(slotDiv!)).toBe('Injected content');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('renders fallback content when no inner HTML is provided', () => {
      components.register('card-fallback', {
        template: '<div class="card"><div data-bind="slot"><em>Fallback</em></div></div>',
        viewModel: { createViewModel() { return {}; } },
        synchronous: true,
      });

      const container = createElement('div');
      const card = createElement('card-fallback');
      container.appendChild(card as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      const slotDiv = container.querySelector('.card div');
      expect(slotDiv).not.toBeNull();
      expect(textOf(slotDiv!)).toBe('Fallback');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('works with virtual element syntax', () => {
      components.register('card-virtual', {
        template: '<div class="card"><!-- tap slot --><!-- /tap --></div>',
        viewModel: { createViewModel() { return {}; } },
        synchronous: true,
      });

      const container = createElement('div');
      const card = createElement('card-virtual');
      card.appendChild(createElement('span', {}, 'Virtual slot content') as never);
      container.appendChild(card as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      const cardDiv = container.querySelector('.card');
      expect(cardDiv).not.toBeNull();
      expect(textOf(cardDiv!)).toContain('Virtual slot content');

      cleanNode(container);
      document.body.removeChild(container as never);
    });
  });

  describe('named slots', () => {
    it('distributes content to named slots', () => {
      components.register('layout-named', {
        template:
          '<header data-bind="slot: \'header\'"></header>' +
          '<main data-bind="slot"></main>' +
          '<footer data-bind="slot: \'footer\'"></footer>',
        viewModel: { createViewModel() { return {}; } },
        synchronous: true,
      });

      const container = createElement('div');
      const layout = createElement('layout-named');
      layout.appendChild(createElement('h1', { slot: 'header' }, 'Title') as never);
      layout.appendChild(createElement('p', {}, 'Body content') as never);
      layout.appendChild(createElement('small', { slot: 'footer' }, 'Footer text') as never);
      container.appendChild(layout as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      const header = container.querySelector('header');
      const main = container.querySelector('main');
      const footer = container.querySelector('footer');

      expect(textOf(header!)).toBe('Title');
      expect(textOf(main!)).toBe('Body content');
      expect(textOf(footer!)).toBe('Footer text');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('shows fallback when a named slot has no matching content', () => {
      components.register('layout-partial', {
        template:
          '<header data-bind="slot: \'header\'"><span>Default Header</span></header>' +
          '<main data-bind="slot"></main>',
        viewModel: { createViewModel() { return {}; } },
        synchronous: true,
      });

      const container = createElement('div');
      const layout = createElement('layout-partial');
      layout.appendChild(createElement('p', {}, 'Just body') as never);
      container.appendChild(layout as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      const header = container.querySelector('header');
      const main = container.querySelector('main');

      expect(textOf(header!)).toBe('Default Header');
      expect(textOf(main!)).toBe('Just body');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('works with virtual element syntax for named slots', () => {
      components.register('layout-virtual-named', {
        template:
          '<div class="head"><!-- tap slot: \'header\' --><!-- /tap --></div>' +
          '<div class="body"><!-- tap slot --><!-- /tap --></div>',
        viewModel: { createViewModel() { return {}; } },
        synchronous: true,
      });

      const container = createElement('div');
      const layout = createElement('layout-virtual-named');
      layout.appendChild(createElement('b', { slot: 'header' }, 'VH') as never);
      layout.appendChild(createElement('span', {}, 'VB') as never);
      container.appendChild(layout as never);
      document.body.appendChild(container as never);

      applyBindings({}, container);

      const headDiv = container.querySelector('.head');
      const bodyDiv = container.querySelector('.body');

      expect(textOf(headDiv!)).toContain('VH');
      expect(textOf(bodyDiv!)).toContain('VB');

      cleanNode(container);
      document.body.removeChild(container as never);
    });
  });

  describe('binding context', () => {
    it('binds slotted content in the parent (outer) context', () => {
      class InnerVM {
        @reactive accessor innerVal: string = 'inner';
      }

      components.register('ctx-slot', {
        template: '<div class="inside"><div data-bind="slot"></div></div>',
        viewModel: {
          createViewModel() { return new InnerVM(); },
        },
        synchronous: true,
      });

      class ParentVM {
        @reactive accessor parentVal: string = 'from parent';
      }

      const parentVM = new ParentVM();

      const container = createElement('div');
      const comp = createElement('ctx-slot');
      comp.appendChild(createElement('span', { 'data-bind': 'text: parentVal' }) as never);
      container.appendChild(comp as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      const span = container.querySelector('.inside span');
      expect(span).not.toBeNull();
      expect(textOf(span!)).toBe('from parent');

      cleanNode(container);
      document.body.removeChild(container as never);
    });

    it('parent context bindings update reactively', () => {
      components.register('ctx-reactive-slot', {
        template: '<div class="wrap"><div data-bind="slot"></div></div>',
        viewModel: {
          createViewModel() { return {}; },
        },
        synchronous: true,
      });

      class ParentVM {
        @reactive accessor message: string = 'Hello';
      }

      const parentVM = new ParentVM();

      const container = createElement('div');
      const comp = createElement('ctx-reactive-slot');
      comp.appendChild(createElement('span', { 'data-bind': 'text: message' }) as never);
      container.appendChild(comp as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      const span = container.querySelector('.wrap span');
      expect(textOf(span!)).toBe('Hello');

      parentVM.message = 'Updated';
      expect(textOf(span!)).toBe('Updated');

      cleanNode(container);
      document.body.removeChild(container as never);
    });
  });

  describe('with @component decorator', () => {
    it('works end-to-end with decorator-registered components', () => {
      @component({
        tag: 'decorated-slot',
        template: '<section><div data-bind="slot: \'header\'"></div><div data-bind="slot"></div></section>',
        synchronous: true,
      })
      class DecoratedSlot {
        @reactive accessor label: string = 'component label';
      }

      class ParentVM {
        @reactive accessor heading: string = 'Parent Heading';
      }

      const parentVM = new ParentVM();

      const container = createElement('div');
      const comp = createElement('decorated-slot');
      comp.appendChild(createElement('h2', { slot: 'header', 'data-bind': 'text: heading' }) as never);
      comp.appendChild(createElement('p', {}, 'Static body') as never);
      container.appendChild(comp as never);
      document.body.appendChild(container as never);

      applyBindings(parentVM, container);

      const section = container.querySelector('section');
      const h2 = section!.querySelector('h2');
      const p = section!.querySelector('p');

      expect(textOf(h2!)).toBe('Parent Heading');
      expect(textOf(p!)).toBe('Static body');

      parentVM.heading = 'New Heading';
      expect(textOf(h2!)).toBe('New Heading');

      cleanNode(container);
      document.body.removeChild(container as never);
    });
  });
});
