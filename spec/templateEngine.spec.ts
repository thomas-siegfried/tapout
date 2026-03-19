import { Window } from 'happy-dom';
import {
  DomElementSource,
  AnonymousSource,
  NativeTemplateEngine,
  nativeTemplateEngine,
  BindingContext,
  applyBindings,
  bindingHandlers,
  Observable,
  allowedVirtualElementBindings,
} from '#src/index.js';

const window = new Window();
const document = window.document;

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

// ---- Template Sources ----

describe('DomElementSource', () => {
  it('reads/writes text from a <script> element', () => {
    const script = createElement('script', { type: 'text/html' }) as HTMLScriptElement;
    (script as unknown as Record<string, unknown>).text = '<span>hello</span>';
    const source = new DomElementSource(script);
    expect(source.text()).toBe('<span>hello</span>');
    source.text('<div>updated</div>');
    expect(source.text()).toBe('<div>updated</div>');
  });

  it('reads/writes text from a <textarea> element', () => {
    const textarea = createElement('textarea') as HTMLTextAreaElement;
    (textarea as HTMLTextAreaElement).value = 'test content';
    const source = new DomElementSource(textarea);
    expect(source.text()).toBe('test content');
    source.text('new content');
    expect(source.text()).toBe('new content');
  });

  it('reads/writes text from a regular element via innerHTML', () => {
    const div = createElement('div');
    div.innerHTML = '<b>bold</b>';
    const source = new DomElementSource(div);
    expect(source.text()).toBe('<b>bold</b>');
    source.text('<i>italic</i>');
    expect(source.text()).toContain('italic');
  });

  it('stores and retrieves data', () => {
    const div = createElement('div');
    const source = new DomElementSource(div);
    expect(source.data('myKey')).toBeUndefined();
    source.data('myKey', 42);
    expect(source.data('myKey')).toBe(42);
  });

  it('reads nodes from a regular element', () => {
    const div = createElement('div', {}, createElement('span'));
    const source = new DomElementSource(div);
    const nodes = source.nodes();
    expect(nodes).toBeTruthy();
  });
});

describe('AnonymousSource', () => {
  it('stores and retrieves nodes via domData', () => {
    const div = createElement('div');
    const source = new AnonymousSource(div);
    const container = createElement('div', {}, createElement('span'));
    source.nodes(container as unknown as HTMLElement);
    expect(source.nodes()).toBe(container as unknown as HTMLElement);
  });

  it('stores and retrieves text via domData', () => {
    const div = createElement('div');
    const source = new AnonymousSource(div);
    source.text('anonymous text');
    expect(source.text()).toBe('anonymous text');
  });

  it('reads text from stored nodes if no explicit text is set', () => {
    const div = createElement('div');
    const source = new AnonymousSource(div);
    const container = createElement('div');
    container.innerHTML = '<b>from nodes</b>';
    source.nodes(container as HTMLElement);
    expect(source.text()).toContain('from nodes');
  });
});

// ---- NativeTemplateEngine ----

describe('NativeTemplateEngine', () => {
  it('is the exported singleton', () => {
    expect(nativeTemplateEngine).toBeInstanceOf(NativeTemplateEngine);
  });

  it('has allowTemplateRewriting set to false', () => {
    expect(nativeTemplateEngine.allowTemplateRewriting).toBe(false);
  });

  it('renders a DomElementSource by cloning its nodes', () => {
    const container = createElement('div');
    container.innerHTML = '<span>test</span><em>foo</em>';
    const source = new DomElementSource(container);
    const ctx = new BindingContext({});
    const nodes = nativeTemplateEngine.renderTemplateSource(source, ctx, {});
    expect(nodes.length).toBe(2);
    expect((nodes[0] as Element).tagName?.toLowerCase()).toBe('span');
    expect((nodes[1] as Element).tagName?.toLowerCase()).toBe('em');
  });

  it('renders an AnonymousSource by cloning its nodes', () => {
    const el = createElement('div');
    const source = new AnonymousSource(el);
    const container = createElement('div');
    container.innerHTML = '<p>paragraph</p>';
    source.nodes(container as HTMLElement);
    const ctx = new BindingContext({});
    const nodes = nativeTemplateEngine.renderTemplateSource(source, ctx, {});
    expect(nodes.length).toBe(1);
    expect((nodes[0] as Element).tagName?.toLowerCase()).toBe('p');
  });

  it('makeTemplateSource returns DomElementSource for a named template', () => {
    const script = createElement('script', { type: 'text/html', id: 'my-template' });
    document.body.appendChild(script as never);
    try {
      const source = nativeTemplateEngine.makeTemplateSource('my-template', document as unknown as Document);
      expect(source).toBeInstanceOf(DomElementSource);
    } finally {
      document.body.removeChild(script as never);
    }
  });

  it('makeTemplateSource throws for missing named template', () => {
    expect(() => nativeTemplateEngine.makeTemplateSource('nonexistent', document as unknown as Document))
      .toThrowError(/Cannot find template with ID/);
  });

  it('makeTemplateSource returns AnonymousSource for element nodes', () => {
    const div = createElement('div');
    const source = nativeTemplateEngine.makeTemplateSource(div);
    expect(source).toBeInstanceOf(AnonymousSource);
  });

  it('makeTemplateSource returns AnonymousSource for comment nodes', () => {
    const comment = createComment(' tap ');
    const source = nativeTemplateEngine.makeTemplateSource(comment);
    expect(source).toBeInstanceOf(AnonymousSource);
  });
});

// ---- template binding ----

describe('template binding', () => {
  it('is registered as a binding handler', () => {
    expect(bindingHandlers['template']).toBeDefined();
    expect(bindingHandlers['template'].init).toBeDefined();
    expect(bindingHandlers['template'].update).toBeDefined();
  });

  it('is allowed on virtual elements', () => {
    expect(allowedVirtualElementBindings['template']).toBe(true);
  });

  it('renders anonymous template content', () => {
    const container = createElement('div', { 'data-bind': 'template: {}' },
      createElement('span', { 'data-bind': 'text: name' }),
    );
    applyBindings({ name: 'Alice' }, container);
    const span = container.querySelector('span');
    expect(span).toBeTruthy();
    expect(span!.textContent).toBe('Alice');
  });

  it('renders named template via id', () => {
    const script = createElement('script', { type: 'text/html', id: 'named-tmpl' });
    (script as unknown as Record<string, unknown>).text = '<em data-bind="text: title"></em>';
    document.body.appendChild(script as never);
    const container = createElement('div', { 'data-bind': "template: 'named-tmpl'" });
    document.body.appendChild(container as never);
    try {
      applyBindings({ title: 'Hello' }, container);
      const em = container.querySelector('em');
      expect(em).toBeTruthy();
      expect(em!.textContent).toBe('Hello');
    } finally {
      document.body.removeChild(script as never);
      document.body.removeChild(container as never);
    }
  });

  it('renders with data option creating a child context', () => {
    const container = createElement('div', { 'data-bind': "template: { name: 'data-tmpl', data: person }" });
    const script = createElement('script', { type: 'text/html', id: 'data-tmpl' });
    (script as unknown as Record<string, unknown>).text = '<span data-bind="text: first"></span>';
    document.body.appendChild(script as never);
    document.body.appendChild(container as never);
    try {
      applyBindings({ person: { first: 'Bob' } }, container);
      expect(container.querySelector('span')!.textContent).toBe('Bob');
    } finally {
      document.body.removeChild(script as never);
      document.body.removeChild(container as never);
    }
  });
});
