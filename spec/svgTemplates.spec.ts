import { Window } from 'happy-dom';
import {
  applyBindings,
  cleanNode,
  components,
  parseHtmlFragment,
} from '#src/index.js';

const window = new Window();
const document = window.document;
(globalThis as Record<string, unknown>).document = document;

const SVG_NS = 'http://www.w3.org/2000/svg';

describe('parseHtmlFragment svg mode', () => {
  it('parses markup into HTML-namespace elements by default', () => {
    const nodes = parseHtmlFragment('<rect width="1"></rect>', document as never);
    expect((nodes[0] as Element).namespaceURI).not.toBe(SVG_NS);
  });

  it('parses markup into SVG-namespace elements when svg is set', () => {
    const nodes = parseHtmlFragment('<rect width="1"></rect><g><circle r="2"/></g>', document as never, true);
    expect(nodes.length).toBe(2);
    expect((nodes[0] as Element).namespaceURI).toBe(SVG_NS);
    expect((nodes[1] as Element).namespaceURI).toBe(SVG_NS);
    expect(((nodes[1] as Element).firstChild as Element).namespaceURI).toBe(SVG_NS);
  });

  it('does not leave the nodes attached to a parent the caller needs to clean up', () => {
    const nodes = parseHtmlFragment('<rect></rect>', document as never, true);
    expect(nodes.length).toBe(1);
    expect(nodes[0].nodeName.toLowerCase()).toBe('rect');
  });
});

describe('component template { svg: string }', () => {
  afterEach(() => {
    components._resetForTesting();
  });

  it('creates template nodes in the SVG namespace', () => {
    components.register('svg-shape', {
      template: { svg: '<rect width="10" height="10"></rect>' },
      synchronous: true,
    });
    const container = document.createElement('div');
    container.innerHTML = '<svg><g data-bind="component: \'svg-shape\'"></g></svg>';
    document.body.appendChild(container as never);

    applyBindings({}, container as unknown as Node);

    const rect = container.querySelector('rect')!;
    expect(rect).not.toBeNull();
    expect(rect.namespaceURI).toBe(SVG_NS);

    cleanNode(container as unknown as Node);
    document.body.removeChild(container as never);
  });

  it('applies bindings to the SVG template nodes', () => {
    components.register('svg-shape', {
      template: { svg: '<rect data-bind="attr: { fill: color }"></rect>' },
      viewModel: function (this: { color: unknown }, params: { color: unknown }) {
        this.color = params.color;
      } as never,
      synchronous: true,
    });
    const container = document.createElement('div');
    container.innerHTML = '<svg><svg-shape params="color: \'red\'"></svg-shape></svg>';
    document.body.appendChild(container as never);

    applyBindings({}, container as unknown as Node);

    expect(container.querySelector('rect')!.getAttribute('fill')).toBe('red');

    cleanNode(container as unknown as Node);
    document.body.removeChild(container as never);
  });

  it('still parses plain string templates as HTML', () => {
    components.register('html-shape', {
      template: '<span>text</span>',
      synchronous: true,
    });
    const container = document.createElement('div');
    container.innerHTML = '<div data-bind="component: \'html-shape\'"></div>';
    document.body.appendChild(container as never);

    applyBindings({}, container as unknown as Node);

    expect(container.querySelector('span')!.namespaceURI).not.toBe(SVG_NS);

    cleanNode(container as unknown as Node);
    document.body.removeChild(container as never);
  });
});
