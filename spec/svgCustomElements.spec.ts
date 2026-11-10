import { Window } from 'happy-dom';
import {
  applyBindings,
  cleanNode,
  components,
  contextFor,
  getComponentNameForNode,
  bindingProviderInstance,
  Observable,
  ObservableArray,
  options,
} from '#src/index.js';

const window = new Window();
const document = window.document;
(globalThis as Record<string, unknown>).document = document;

const SVG_NS = 'http://www.w3.org/2000/svg';
const XHTML_NS = 'http://www.w3.org/1999/xhtml';
const XLINK_NS = 'http://www.w3.org/1999/xlink';

function mount(html: string): HTMLElement {
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container as never);
  return container as unknown as HTMLElement;
}

function unmount(container: HTMLElement): void {
  cleanNode(container);
  document.body.removeChild(container as never);
}

function host(container: Element, name: string): Element | null {
  return container.querySelector('[data-tap-component="' + name + '"]');
}

describe('SVG custom elements', () => {
  afterEach(() => {
    components._resetForTesting();
    options.svgCustomElements = true;
    options.customElementDisplayContents = true;
  });

  it('replaces a registered custom element inside svg with a marked <g> and renders its template', () => {
    components.register('x-comp', {
      template: '<circle r="5"></circle>',
      synchronous: true,
    });
    const container = mount('<svg><x-comp params="a: 1"></x-comp></svg>');

    applyBindings({}, container);

    const g = host(container as unknown as Element, 'x-comp')!;
    expect(g).not.toBeNull();
    expect(g.localName).toBe('g');
    expect(g.namespaceURI).toBe(SVG_NS);
    expect(container.querySelector('x-comp')).toBeNull();
    expect(g.querySelector('circle')).not.toBeNull();

    unmount(container);
  });

  it('never applies display:contents to the SVG host', () => {
    components.register('x-comp', { template: '<circle r="5"></circle>', synchronous: true });
    const container = mount('<svg><x-comp></x-comp></svg>');

    applyBindings({}, container);

    const g = host(container as unknown as Element, 'x-comp') as unknown as SVGElement;
    expect(g.style.display).not.toBe('contents');

    unmount(container);
  });

  it('preserves attributes and moves children into the host', () => {
    let templateNodes: Node[] = [];
    components.register('x-comp', {
      template: '<g class="inner"></g>',
      viewModel: {
        createViewModel(_params: unknown, info: { templateNodes: Node[] }) {
          templateNodes = info.templateNodes;
          return {};
        },
      },
      synchronous: true,
    });
    const container = mount(
      '<svg><x-comp class="cell" transform="translate(5 5)" id="h1"><rect id="child"></rect></x-comp></svg>',
    );

    applyBindings({}, container);

    const g = host(container as unknown as Element, 'x-comp')!;
    expect(g.getAttribute('class')).toBe('cell');
    expect(g.getAttribute('transform')).toBe('translate(5 5)');
    expect(g.id).toBe('h1');
    expect(templateNodes.length).toBe(1);
    expect((templateNodes[0] as Element).id).toBe('child');
    expect((templateNodes[0] as Element).namespaceURI).toBe(SVG_NS);

    unmount(container);
  });

  it('keeps the namespace of namespaced attributes', () => {
    components.register('x-comp', { template: '<circle r="5"></circle>', synchronous: true });
    const container = mount('<svg><x-comp xlink:href="#target"></x-comp></svg>');

    applyBindings({}, container);

    const g = host(container as unknown as Element, 'x-comp')!;
    expect(g.getAttributeNS(XLINK_NS, 'href')).toBe('#target');

    unmount(container);
  });

  it('keeps the data-bind attribute and applies it to the host', () => {
    components.register('x-comp', { template: '<circle r="5"></circle>', synchronous: true });
    const container = mount('<svg><x-comp data-bind="attr: { fill: color }"></x-comp></svg>');

    applyBindings({ color: 'red' }, container);

    const g = host(container as unknown as Element, 'x-comp')!;
    expect(g.getAttribute('fill')).toBe('red');
    expect(g.querySelector('circle')).not.toBeNull();

    unmount(container);
  });

  it('passes params to the component view model', () => {
    let received: unknown;
    components.register('x-comp', {
      template: '<text data-bind="text: label"></text>',
      viewModel: function (this: { label: unknown }, params: { label: unknown }) {
        received = params.label;
        this.label = params.label;
      } as never,
      synchronous: true,
    });
    const container = mount('<svg><x-comp params="label: \'hi\'"></x-comp></svg>');

    applyBindings({}, container);

    expect(received).toBe('hi');
    expect(container.querySelector('text')!.textContent).toBe('hi');

    unmount(container);
  });

  it('supports $name params that share the parent observable (two-way)', () => {
    let shared: unknown;
    components.register('x-comp', {
      template: '<circle r="5"></circle>',
      viewModel: function (this: unknown, params: { value: unknown }) {
        shared = params.value;
      } as never,
      synchronous: true,
    });
    const vm = { value: new Observable(1) };
    const container = mount('<svg><x-comp params="value: $value"></x-comp></svg>');

    applyBindings(vm, container);

    expect(shared).toBe(vm.value);
    (shared as Observable<number>).set(7);
    expect(vm.value.get()).toBe(7);

    unmount(container);
  });

  it('updates a param expression without re-creating the component view model', () => {
    let created = 0;
    let params: { size: { get(): unknown } } | undefined;
    components.register('x-comp', {
      template: '<circle r="5"></circle>',
      viewModel: function (this: unknown, p: { size: { get(): unknown } }) {
        created++;
        params = p;
      } as never,
      synchronous: true,
    });
    const vm = { size: new Observable(1) };
    const container = mount('<svg><x-comp params="size: size.get() * 2"></x-comp></svg>');

    applyBindings(vm, container);

    expect(created).toBe(1);
    expect(params!.size.get()).toBe(2);
    vm.size.set(5);
    expect(created).toBe(1);
    expect(params!.size.get()).toBe(10);

    unmount(container);
  });

  it('works for nodes produced by foreach', () => {
    components.register('x-item', {
      template: '<text data-bind="text: label"></text>',
      viewModel: function (this: { label: unknown }, params: { label: unknown }) {
        this.label = params.label;
      } as never,
      synchronous: true,
    });
    const items = new ObservableArray([{ name: 'a' }, { name: 'b' }]);
    const container = mount(
      '<svg data-bind="foreach: items"><x-item params="label: name"></x-item></svg>',
    );

    applyBindings({ items }, container);

    expect(container.querySelectorAll('[data-tap-component="x-item"]').length).toBe(2);
    expect(container.querySelectorAll('text').length).toBe(2);
    expect(container.querySelector('x-item')).toBeNull();

    items.push({ name: 'c' });
    expect(container.querySelectorAll('[data-tap-component="x-item"]').length).toBe(3);
    expect(Array.from(container.querySelectorAll('text')).map(t => t.textContent)).toEqual(['a', 'b', 'c']);

    unmount(container);
  });

  it('works for custom elements inside a component template', () => {
    components.register('x-inner', { template: '<circle r="2"></circle>', synchronous: true });

    // Parse inside <svg> so the template's custom element is in the SVG namespace.
    const svgParent = document.createElementNS(SVG_NS, 'svg');
    svgParent.innerHTML = '<x-inner></x-inner>';
    components.register('x-outer', { template: Array.from(svgParent.childNodes) as never, synchronous: true });

    const container = mount('<svg><x-outer></x-outer></svg>');
    applyBindings({}, container);

    const inner = host(container as unknown as Element, 'x-inner')!;
    expect(inner).not.toBeNull();
    expect(inner.querySelector('circle')).not.toBeNull();

    unmount(container);
  });

  it('leaves unregistered custom elements inside svg alone', () => {
    const container = mount('<svg><x-unknown></x-unknown></svg>');

    applyBindings({}, container);

    expect(container.querySelector('x-unknown')).not.toBeNull();
    expect(container.querySelector('[data-tap-component]')).toBeNull();

    unmount(container);
  });

  it('does not rewrite when options.svgCustomElements is false', () => {
    options.svgCustomElements = false;
    components.register('x-comp', { template: '<circle r="5"></circle>', synchronous: true });
    const container = mount('<svg><x-comp></x-comp></svg>');

    applyBindings({}, container);

    expect(container.querySelector('x-comp')).not.toBeNull();
    expect(container.querySelector('[data-tap-component]')).toBeNull();

    unmount(container);
  });

  it('still applies display:contents to HTML custom elements', () => {
    components.register('x-comp', { template: '<span>c</span>', synchronous: true });
    const container = mount('<div><x-comp></x-comp></div>');

    applyBindings({}, container);

    const el = container.querySelector('x-comp') as HTMLElement;
    expect(el.style.display).toBe('contents');
    expect(container.querySelector('[data-tap-component]')).toBeNull();

    unmount(container);
  });

  it('does not rewrite HTML-namespace custom elements (e.g. inside foreignObject)', () => {
    components.register('x-comp', { template: '<span>c</span>', synchronous: true });
    // Build explicitly: real browsers switch back to the HTML namespace inside <foreignObject>.
    const container = document.createElement('div');
    const svg = document.createElementNS(SVG_NS, 'svg');
    const fo = document.createElementNS(SVG_NS, 'foreignObject');
    const htmlComp = document.createElementNS(XHTML_NS, 'x-comp') as unknown as HTMLElement;
    fo.appendChild(htmlComp as never);
    svg.appendChild(fo);
    container.appendChild(svg);
    document.body.appendChild(container as never);

    applyBindings({}, container as unknown as Node);

    expect(container.querySelector('x-comp')).toBe(htmlComp as never);
    expect(htmlComp.style.display).toBe('contents');
    expect(container.querySelector('[data-tap-component]')).toBeNull();

    unmount(container as unknown as HTMLElement);
  });

  it('keeps contextFor working on the host', () => {
    components.register('x-comp', { template: '<circle r="5"></circle>', synchronous: true });
    const vm = { name: 'root' };
    const container = mount('<svg><x-comp></x-comp></svg>');

    applyBindings(vm, container);

    const g = host(container as unknown as Element, 'x-comp')!;
    expect(contextFor(g as never)!.$data).toBe(vm);

    unmount(container);
  });
});

describe('getComponentNameForNode marker fallback', () => {
  afterEach(() => {
    components._resetForTesting();
  });

  it('resolves the component name from the data-tap-component marker', () => {
    components.register('x-comp', { template: '<circle></circle>', synchronous: true });
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-tap-component', 'x-comp');

    expect(getComponentNameForNode(g as never)).toBe('x-comp');
    expect(bindingProviderInstance.nodeHasBindings(g as never)).toBe(true);
  });

  it('ignores the marker when the component is not registered', () => {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('data-tap-component', 'x-missing');

    expect(getComponentNameForNode(g as never)).toBeUndefined();
  });
});
