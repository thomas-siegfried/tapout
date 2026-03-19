import { Window } from 'happy-dom';
import {
  applyBindings,
  Observable,
  bindingHandlers,
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

// ---- if binding ----

describe('if binding', () => {
  it('is registered as a handler', () => {
    expect(bindingHandlers['if']).toBeDefined();
  });

  it('is allowed on virtual elements', () => {
    expect(allowedVirtualElementBindings['if']).toBe(true);
  });

  it('renders content when condition is truthy', () => {
    const div = createElement('div', { 'data-bind': 'if: show' },
      createElement('span', { 'data-bind': 'text: name' }),
    );
    applyBindings({ show: true, name: 'Alice' }, div);
    expect(div.querySelector('span')!.textContent).toBe('Alice');
  });

  it('hides content when condition is falsy', () => {
    const div = createElement('div', { 'data-bind': 'if: show' },
      createElement('span', { 'data-bind': 'text: name' }),
    );
    applyBindings({ show: false, name: 'Alice' }, div);
    expect(div.querySelector('span')).toBeNull();
  });

  it('toggles content when observable changes', () => {
    const show = new Observable(true);
    const div = createElement('div', { 'data-bind': 'if: show' },
      createElement('span', {}, 'content'),
    );
    applyBindings({ show }, div);
    expect(div.querySelector('span')).toBeTruthy();

    show.set(false);
    expect(div.querySelector('span')).toBeNull();

    show.set(true);
    expect(div.querySelector('span')).toBeTruthy();
    expect(div.querySelector('span')!.textContent).toBe('content');
  });

  it('works with virtual elements', () => {
    const container = createElement('div');
    const startComment = createComment(' tap if: show ');
    const span = createElement('span', {}, 'inside');
    const endComment = createComment(' /tap ');
    container.appendChild(startComment as never);
    container.appendChild(span as never);
    container.appendChild(endComment as never);

    const show = new Observable(true);
    applyBindings({ show }, container);
    expect(container.querySelectorAll('span').length).toBe(1);

    show.set(false);
    expect(container.querySelectorAll('span').length).toBe(0);

    show.set(true);
    expect(container.querySelectorAll('span').length).toBe(1);
  });
});

// ---- ifnot binding ----

describe('ifnot binding', () => {
  it('is registered as a handler', () => {
    expect(bindingHandlers['ifnot']).toBeDefined();
  });

  it('is allowed on virtual elements', () => {
    expect(allowedVirtualElementBindings['ifnot']).toBe(true);
  });

  it('renders content when condition is falsy', () => {
    const div = createElement('div', { 'data-bind': 'ifnot: hide' },
      createElement('span', {}, 'visible'),
    );
    applyBindings({ hide: false }, div);
    expect(div.querySelector('span')!.textContent).toBe('visible');
  });

  it('hides content when condition is truthy', () => {
    const div = createElement('div', { 'data-bind': 'ifnot: hide' },
      createElement('span', {}, 'visible'),
    );
    applyBindings({ hide: true }, div);
    expect(div.querySelector('span')).toBeNull();
  });

  it('toggles on observable changes', () => {
    const hide = new Observable(false);
    const div = createElement('div', { 'data-bind': 'ifnot: hide' },
      createElement('span', {}, 'content'),
    );
    applyBindings({ hide }, div);
    expect(div.querySelector('span')).toBeTruthy();

    hide.set(true);
    expect(div.querySelector('span')).toBeNull();

    hide.set(false);
    expect(div.querySelector('span')).toBeTruthy();
  });
});

// ---- with binding ----

describe('with binding', () => {
  it('is registered as a handler', () => {
    expect(bindingHandlers['with']).toBeDefined();
  });

  it('is allowed on virtual elements', () => {
    expect(allowedVirtualElementBindings['with']).toBe(true);
  });

  it('creates a child context with the value as $data', () => {
    const div = createElement('div', { 'data-bind': 'with: person' },
      createElement('span', { 'data-bind': 'text: name' }),
    );
    applyBindings({ person: { name: 'Bob' } }, div);
    expect(div.querySelector('span')!.textContent).toBe('Bob');
  });

  it('hides content when value is falsy', () => {
    const div = createElement('div', { 'data-bind': 'with: person' },
      createElement('span', {}, 'should not appear'),
    );
    applyBindings({ person: null }, div);
    expect(div.querySelector('span')).toBeNull();
  });

  it('toggles when observable changes', () => {
    const person = new Observable<{ name: string } | null>({ name: 'Alice' });
    const div = createElement('div', { 'data-bind': 'with: person' },
      createElement('span', { 'data-bind': 'text: name' }),
    );
    applyBindings({ person }, div);
    expect(div.querySelector('span')!.textContent).toBe('Alice');

    person.set(null);
    expect(div.querySelector('span')).toBeNull();

    person.set({ name: 'Charlie' });
    expect(div.querySelector('span')!.textContent).toBe('Charlie');
  });

  it('works with virtual elements', () => {
    const container = createElement('div');
    container.appendChild(createComment(' tap with: person ') as never);
    container.appendChild(createElement('span', { 'data-bind': 'text: name' }) as never);
    container.appendChild(createComment(' /tap ') as never);

    applyBindings({ person: { name: 'Dave' } }, container);
    expect(container.querySelector('span')!.textContent).toBe('Dave');
  });
});

// ---- let binding ----

describe('let binding', () => {
  it('is registered as a handler', () => {
    expect(bindingHandlers['let']).toBeDefined();
  });

  it('is allowed on virtual elements', () => {
    expect(allowedVirtualElementBindings['let']).toBe(true);
  });

  it('extends the binding context with additional properties', () => {
    const div = createElement('div', { 'data-bind': 'let: { greeting: "Hello" }' },
      createElement('span', { 'data-bind': 'text: greeting' }),
    );
    applyBindings({}, div);
    expect(div.querySelector('span')!.textContent).toBe('Hello');
  });

  it('preserves existing context properties', () => {
    const div = createElement('div', { 'data-bind': 'let: { extra: "bonus" }' },
      createElement('span', { 'data-bind': 'text: name' }),
      createElement('em', { 'data-bind': 'text: extra' }),
    );
    applyBindings({ name: 'Root' }, div);
    expect(div.querySelector('span')!.textContent).toBe('Root');
    expect(div.querySelector('em')!.textContent).toBe('bonus');
  });

  it('works with virtual elements', () => {
    const container = createElement('div');
    container.appendChild(createComment(' tap let: { msg: "hi" } ') as never);
    container.appendChild(createElement('span', { 'data-bind': 'text: msg' }) as never);
    container.appendChild(createComment(' /tap ') as never);

    applyBindings({}, container);
    expect(container.querySelector('span')!.textContent).toBe('hi');
  });
});

// ---- using binding ----

describe('using binding', () => {
  it('is registered as a handler', () => {
    expect(bindingHandlers['using']).toBeDefined();
  });

  it('is allowed on virtual elements', () => {
    expect(allowedVirtualElementBindings['using']).toBe(true);
  });

  it('creates a child context with the value as $data', () => {
    const div = createElement('div', { 'data-bind': 'using: person' },
      createElement('span', { 'data-bind': 'text: name' }),
    );
    applyBindings({ person: { name: 'Eve' } }, div);
    expect(div.querySelector('span')!.textContent).toBe('Eve');
  });

  it('works with virtual elements', () => {
    const container = createElement('div');
    container.appendChild(createComment(' tap using: person ') as never);
    container.appendChild(createElement('span', { 'data-bind': 'text: name' }) as never);
    container.appendChild(createComment(' /tap ') as never);

    applyBindings({ person: { name: 'Frank' } }, container);
    expect(container.querySelector('span')!.textContent).toBe('Frank');
  });
});
