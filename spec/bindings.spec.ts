import { Window } from 'happy-dom';
import {
  applyBindings,
  applyBindingsToNode,
  bindingHandlers,
  Observable,
  allowedVirtualElementBindings,
} from '#src/index.js';

const window = new Window();
const document = window.document;

function createElement(tag: string, attrs: Record<string, string> = {}, ...children: Node[]): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  for (const child of children) el.appendChild(child as never);
  return el as unknown as Element;
}

function createComment(text: string): Comment {
  return document.createComment(text) as unknown as Comment;
}

// ---- Task 17: One-way display bindings ----

describe('text binding', () => {
  it('sets text content of an element', () => {
    const el = createElement('span', { 'data-bind': 'text: msg' });
    applyBindings({ msg: 'Hello' }, el);
    expect(el.textContent).toBe('Hello');
  });

  it('treats null as empty string', () => {
    const el = createElement('span', { 'data-bind': 'text: msg' });
    applyBindings({ msg: null }, el);
    expect(el.textContent).toBe('');
  });

  it('treats undefined as empty string', () => {
    const el = createElement('span', { 'data-bind': 'text: msg' });
    applyBindings({ msg: undefined }, el);
    expect(el.textContent).toBe('');
  });

  it('converts numbers to string', () => {
    const el = createElement('span', { 'data-bind': 'text: val' });
    applyBindings({ val: 42 }, el);
    expect(el.textContent).toBe('42');
  });

  it('updates reactively when observable changes', () => {
    const msg = new Observable('before');
    const el = createElement('span', { 'data-bind': 'text: msg' });
    applyBindings({ msg }, el);
    expect(el.textContent).toBe('before');

    msg.set('after');
    expect(el.textContent).toBe('after');
  });

  it('controls descendant bindings (does not bind children)', () => {
    const el = createElement('div', { 'data-bind': 'text: msg' },
      createElement('span', { 'data-bind': 'text: inner' }) as unknown as Node,
    );
    expect(() => applyBindings({ msg: 'hi', inner: 'no' }, el)).not.toThrow();
    expect(el.textContent).toBe('hi');
  });

  it('replaces existing children with a text node', () => {
    const el = createElement('div', { 'data-bind': 'text: msg' },
      createElement('b') as unknown as Node,
      createElement('i') as unknown as Node,
    );
    applyBindings({ msg: 'replaced' }, el);
    expect(el.childNodes.length).toBe(1);
    expect(el.childNodes[0].nodeType).toBe(3);
    expect(el.textContent).toBe('replaced');
  });

  it('reuses existing text node on subsequent updates', () => {
    const obs = new Observable('first');
    const el = createElement('span', { 'data-bind': 'text: obs' });
    applyBindings({ obs }, el);
    const textNode = el.firstChild;

    obs.set('second');
    expect(el.firstChild).toBe(textNode);
    expect(el.textContent).toBe('second');
  });

  it('is allowed on virtual elements', () => {
    expect(allowedVirtualElementBindings['text']).toBe(true);

    const container = createElement('div');
    const start = createComment(' tap text: msg ');
    const end = createComment(' /tap ');
    container.appendChild(start as unknown as Node);
    container.appendChild(end as unknown as Node);

    applyBindings({ msg: 'virtual' }, container);
    expect(container.textContent).toBe('virtual');
  });
});

describe('html binding', () => {
  it('sets innerHTML of an element', () => {
    const el = createElement('div', { 'data-bind': 'html: content' });
    applyBindings({ content: '<b>bold</b>' }, el);
    expect(el.innerHTML).toBe('<b>bold</b>');
  });

  it('handles null as empty', () => {
    const el = createElement('div', { 'data-bind': 'html: content' });
    el.innerHTML = 'existing';
    applyBindings({ content: null }, el);
    expect(el.innerHTML).toBe('');
  });

  it('handles undefined as empty', () => {
    const el = createElement('div', { 'data-bind': 'html: content' });
    el.innerHTML = 'existing';
    applyBindings({ content: undefined }, el);
    expect(el.innerHTML).toBe('');
  });

  it('converts non-string values to string', () => {
    const el = createElement('div', { 'data-bind': 'html: content' });
    applyBindings({ content: 123 }, el);
    expect(el.innerHTML).toBe('123');
  });

  it('updates reactively', () => {
    const content = new Observable('<em>a</em>');
    const el = createElement('div', { 'data-bind': 'html: content' });
    applyBindings({ content }, el);
    expect(el.innerHTML).toBe('<em>a</em>');

    content.set('<strong>b</strong>');
    expect(el.innerHTML).toBe('<strong>b</strong>');
  });

  it('controls descendant bindings', () => {
    const handler = bindingHandlers['html'];
    expect(handler.init).toBeDefined();
    const result = handler.init!(
      createElement('div') as Node, () => '', {} as never, undefined, {} as never,
    );
    expect(result).toEqual({ controlsDescendantBindings: true });
  });
});

describe('visible binding', () => {
  it('hides element when value is falsy', () => {
    const el = createElement('div', { 'data-bind': 'visible: show' }) as HTMLElement;
    applyBindings({ show: false }, el);
    expect(el.style.display).toBe('none');
  });

  it('shows element when value is truthy', () => {
    const el = createElement('div', { 'data-bind': 'visible: show' }) as HTMLElement;
    (el as HTMLElement).style.display = 'none';
    applyBindings({ show: true }, el);
    expect(el.style.display).toBe('');
  });

  it('handles various falsy values', () => {
    for (const val of [false, 0, '', null, undefined]) {
      const el = createElement('div', { 'data-bind': 'visible: val' }) as HTMLElement;
      applyBindings({ val }, el);
      expect(el.style.display).toBe('none');
    }
  });

  it('handles various truthy values', () => {
    for (const val of [true, 1, 'yes', {}]) {
      const el = createElement('div', { 'data-bind': 'visible: val' }) as HTMLElement;
      (el as HTMLElement).style.display = 'none';
      applyBindings({ val }, el);
      expect(el.style.display).toBe('');
    }
  });

  it('updates reactively', () => {
    const show = new Observable(true);
    const el = createElement('div', { 'data-bind': 'visible: show' }) as HTMLElement;
    applyBindings({ show }, el);
    expect(el.style.display).not.toBe('none');

    show.set(false);
    expect(el.style.display).toBe('none');

    show.set(true);
    expect(el.style.display).toBe('');
  });
});

describe('hidden binding', () => {
  it('hides element when value is truthy (inverse of visible)', () => {
    const el = createElement('div', { 'data-bind': 'hidden: hide' }) as HTMLElement;
    applyBindings({ hide: true }, el);
    expect(el.style.display).toBe('none');
  });

  it('shows element when value is falsy', () => {
    const el = createElement('div', { 'data-bind': 'hidden: hide' }) as HTMLElement;
    (el as HTMLElement).style.display = 'none';
    applyBindings({ hide: false }, el);
    expect(el.style.display).toBe('');
  });

  it('updates reactively', () => {
    const hide = new Observable(false);
    const el = createElement('div', { 'data-bind': 'hidden: hide' }) as HTMLElement;
    applyBindings({ hide }, el);
    expect(el.style.display).not.toBe('none');

    hide.set(true);
    expect(el.style.display).toBe('none');
  });
});

// ---- Task 18: Attribute bindings ----

describe('attr binding', () => {
  it('sets attributes on the element', () => {
    const el = createElement('div', { 'data-bind': "attr: { title: t, id: i }" });
    applyBindings({ t: 'hello', i: 'myId' }, el);
    expect(el.getAttribute('title')).toBe('hello');
    expect(el.getAttribute('id')).toBe('myId');
  });

  it('removes attribute for false', () => {
    const el = createElement('input', { 'data-bind': "attr: { disabled: d }" });
    el.setAttribute('disabled', 'disabled');
    applyBindings({ d: false }, el);
    expect(el.hasAttribute('disabled')).toBe(false);
  });

  it('removes attribute for null', () => {
    const el = createElement('div', { 'data-bind': "attr: { title: t }" });
    el.setAttribute('title', 'old');
    applyBindings({ t: null }, el);
    expect(el.hasAttribute('title')).toBe(false);
  });

  it('removes attribute for undefined', () => {
    const el = createElement('div', { 'data-bind': "attr: { title: t }" });
    el.setAttribute('title', 'old');
    applyBindings({ t: undefined }, el);
    expect(el.hasAttribute('title')).toBe(false);
  });

  it('converts numeric values to string', () => {
    const el = createElement('input', { 'data-bind': "attr: { tabindex: idx }" });
    applyBindings({ idx: 5 }, el);
    expect(el.getAttribute('tabindex')).toBe('5');
  });

  it('updates reactively', () => {
    const title = new Observable('a');
    const el = createElement('div', { 'data-bind': "attr: { title: title }" });
    applyBindings({ title }, el);
    expect(el.getAttribute('title')).toBe('a');

    title.set('b');
    expect(el.getAttribute('title')).toBe('b');
  });

  it('sets the name property for name attribute', () => {
    const el = createElement('input', { 'data-bind': "attr: { name: n }" }) as HTMLInputElement;
    applyBindings({ n: 'myField' }, el);
    expect(el.getAttribute('name')).toBe('myField');
    expect((el as unknown as HTMLInputElement).name).toBe('myField');
  });
});

describe('css binding', () => {
  it('adds classes from an object when value is truthy', () => {
    const el = createElement('div', { 'data-bind': "css: { active: isActive, highlight: isHighlight }" });
    applyBindings({ isActive: true, isHighlight: false }, el);
    expect(el.classList.contains('active')).toBe(true);
    expect(el.classList.contains('highlight')).toBe(false);
  });

  it('removes classes when value becomes falsy', () => {
    const isActive = new Observable(true);
    const el = createElement('div', { 'data-bind': "css: { active: isActive }" });
    applyBindings({ isActive }, el);
    expect(el.classList.contains('active')).toBe(true);

    isActive.set(false);
    expect(el.classList.contains('active')).toBe(false);
  });

  it('handles string value like the class binding', () => {
    const el = createElement('div', { 'data-bind': "css: cls" });
    applyBindings({ cls: 'foo bar' }, el);
    expect(el.classList.contains('foo')).toBe(true);
    expect(el.classList.contains('bar')).toBe(true);
  });

  it('updates reactively with object values', () => {
    const on = new Observable(true);
    const el = createElement('div', { 'data-bind': "css: { toggled: on }" });
    applyBindings({ on }, el);
    expect(el.classList.contains('toggled')).toBe(true);

    on.set(false);
    expect(el.classList.contains('toggled')).toBe(false);
  });
});

describe('class binding', () => {
  it('sets the class value on the element', () => {
    const el = createElement('div', { 'data-bind': "class: cls" });
    applyBindings({ cls: 'alpha beta' }, el);
    expect(el.classList.contains('alpha')).toBe(true);
    expect(el.classList.contains('beta')).toBe(true);
  });

  it('replaces previous classes on update', () => {
    const cls = new Observable('old-class');
    const el = createElement('div', { 'data-bind': "class: cls" });
    applyBindings({ cls }, el);
    expect(el.classList.contains('old-class')).toBe(true);

    cls.set('new-class');
    expect(el.classList.contains('old-class')).toBe(false);
    expect(el.classList.contains('new-class')).toBe(true);
  });

  it('handles null/undefined as empty', () => {
    const el = createElement('div', { 'data-bind': "class: cls" });
    applyBindings({ cls: null }, el);
    expect(el.className).toBe('');
  });

  it('trims whitespace', () => {
    const el = createElement('div', { 'data-bind': "class: cls" });
    applyBindings({ cls: '  spaced  ' }, el);
    expect(el.classList.contains('spaced')).toBe(true);
  });
});

describe('style binding', () => {
  it('sets inline styles', () => {
    const el = createElement('div', { 'data-bind': "style: { color: c }" }) as HTMLElement;
    applyBindings({ c: 'red' }, el);
    expect(el.style.color).toBe('red');
  });

  it('clears style on null', () => {
    const el = createElement('div', { 'data-bind': "style: { color: c }" }) as HTMLElement;
    el.style.color = 'blue';
    applyBindings({ c: null }, el);
    expect(el.style.color).toBe('');
  });

  it('clears style on undefined', () => {
    const el = createElement('div', { 'data-bind': "style: { color: c }" }) as HTMLElement;
    el.style.color = 'blue';
    applyBindings({ c: undefined }, el);
    expect(el.style.color).toBe('');
  });

  it('clears style on false', () => {
    const el = createElement('div', { 'data-bind': "style: { color: c }" }) as HTMLElement;
    el.style.color = 'blue';
    applyBindings({ c: false }, el);
    expect(el.style.color).toBe('');
  });

  it('camel-cases hyphenated property names', () => {
    const el = createElement('div', { 'data-bind': "style: { 'font-weight': fw }" }) as HTMLElement;
    applyBindings({ fw: 'bold' }, el);
    expect(el.style.fontWeight).toBe('bold');
  });

  it('updates reactively', () => {
    const c = new Observable('green');
    const el = createElement('div', { 'data-bind': "style: { color: c }" }) as HTMLElement;
    applyBindings({ c }, el);
    expect(el.style.color).toBe('green');

    c.set('blue');
    expect(el.style.color).toBe('blue');
  });
});

// ---- Task 19: Form state bindings ----

describe('enable binding', () => {
  it('enables a disabled element when value is truthy', () => {
    const el = createElement('input', { 'data-bind': 'enable: on' }) as HTMLInputElement;
    (el as unknown as HTMLInputElement).disabled = true;
    applyBindings({ on: true }, el);
    expect((el as unknown as HTMLInputElement).disabled).toBe(false);
  });

  it('disables an enabled element when value is falsy', () => {
    const el = createElement('input', { 'data-bind': 'enable: on' }) as HTMLInputElement;
    applyBindings({ on: false }, el);
    expect((el as unknown as HTMLInputElement).disabled).toBe(true);
  });

  it('updates reactively', () => {
    const on = new Observable(true);
    const el = createElement('input', { 'data-bind': 'enable: on' }) as HTMLInputElement;
    applyBindings({ on }, el);
    expect((el as unknown as HTMLInputElement).disabled).toBe(false);

    on.set(false);
    expect((el as unknown as HTMLInputElement).disabled).toBe(true);

    on.set(true);
    expect((el as unknown as HTMLInputElement).disabled).toBe(false);
  });
});

describe('disable binding', () => {
  it('disables element when value is truthy (inverse of enable)', () => {
    const el = createElement('input', { 'data-bind': 'disable: off' }) as HTMLInputElement;
    applyBindings({ off: true }, el);
    expect((el as unknown as HTMLInputElement).disabled).toBe(true);
  });

  it('enables element when value is falsy', () => {
    const el = createElement('input', { 'data-bind': 'disable: off' }) as HTMLInputElement;
    (el as unknown as HTMLInputElement).disabled = true;
    applyBindings({ off: false }, el);
    expect((el as unknown as HTMLInputElement).disabled).toBe(false);
  });

  it('updates reactively', () => {
    const off = new Observable(false);
    const el = createElement('input', { 'data-bind': 'disable: off' }) as HTMLInputElement;
    applyBindings({ off }, el);
    expect((el as unknown as HTMLInputElement).disabled).toBe(false);

    off.set(true);
    expect((el as unknown as HTMLInputElement).disabled).toBe(true);
  });
});

describe('uniqueName binding', () => {
  it('assigns a unique name to the element', () => {
    const el = createElement('input', { 'data-bind': 'uniqueName: true' }) as HTMLInputElement;
    applyBindings({}, el);
    expect((el as unknown as HTMLInputElement).name).toMatch(/^tap_unique_\d+$/);
  });

  it('assigns different names to different elements', () => {
    const el1 = createElement('input') as HTMLInputElement;
    const el2 = createElement('input') as HTMLInputElement;
    applyBindingsToNode(el1, { uniqueName: true });
    applyBindingsToNode(el2, { uniqueName: true });
    expect((el1 as unknown as HTMLInputElement).name).not.toBe((el2 as unknown as HTMLInputElement).name);
  });

  it('does not assign a name when value is falsy', () => {
    const el = createElement('input', { 'data-bind': 'uniqueName: false' }) as HTMLInputElement;
    applyBindings({}, el);
    expect((el as unknown as HTMLInputElement).name).toBeFalsy();
  });
});
