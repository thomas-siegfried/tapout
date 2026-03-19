import { Window } from 'happy-dom';
import {
  applyBindings,
  Observable,
  ObservableArray,
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

describe('foreach binding', () => {
  it('is registered as a handler', () => {
    expect(bindingHandlers['foreach']).toBeDefined();
  });

  it('is allowed on virtual elements', () => {
    expect(allowedVirtualElementBindings['foreach']).toBe(true);
  });

  it('renders one item per array element', () => {
    const ul = createElement('ul', { 'data-bind': 'foreach: items' },
      createElement('li', { 'data-bind': 'text: $data' }),
    );
    applyBindings({ items: ['A', 'B', 'C'] }, ul);
    const lis = ul.querySelectorAll('li');
    expect(lis.length).toBe(3);
    expect(lis[0].textContent).toBe('A');
    expect(lis[1].textContent).toBe('B');
    expect(lis[2].textContent).toBe('C');
  });

  it('renders object items with property access', () => {
    const ul = createElement('ul', { 'data-bind': 'foreach: people' },
      createElement('li', { 'data-bind': 'text: name' }),
    );
    applyBindings({ people: [{ name: 'Alice' }, { name: 'Bob' }] }, ul);
    const lis = ul.querySelectorAll('li');
    expect(lis.length).toBe(2);
    expect(lis[0].textContent).toBe('Alice');
    expect(lis[1].textContent).toBe('Bob');
  });

  it('renders empty array as no children', () => {
    const ul = createElement('ul', { 'data-bind': 'foreach: items' },
      createElement('li', { 'data-bind': 'text: $data' }),
    );
    applyBindings({ items: [] }, ul);
    expect(ul.querySelectorAll('li').length).toBe(0);
  });

  it('updates when ObservableArray has items pushed', () => {
    const items = new ObservableArray(['X', 'Y']);
    const ul = createElement('ul', { 'data-bind': 'foreach: items' },
      createElement('li', { 'data-bind': 'text: $data' }),
    );
    applyBindings({ items }, ul);
    expect(ul.querySelectorAll('li').length).toBe(2);

    items.push('Z');
    expect(ul.querySelectorAll('li').length).toBe(3);
    expect(ul.querySelectorAll('li')[2].textContent).toBe('Z');
  });

  it('updates when ObservableArray has items removed', () => {
    const items = new ObservableArray(['A', 'B', 'C']);
    const ul = createElement('ul', { 'data-bind': 'foreach: items' },
      createElement('li', { 'data-bind': 'text: $data' }),
    );
    applyBindings({ items }, ul);
    expect(ul.querySelectorAll('li').length).toBe(3);

    items.splice(1, 1);
    expect(ul.querySelectorAll('li').length).toBe(2);
    expect(ul.querySelectorAll('li')[0].textContent).toBe('A');
    expect(ul.querySelectorAll('li')[1].textContent).toBe('C');
  });

  it('handles complete array replacement', () => {
    const items = new ObservableArray(['A', 'B']);
    const ul = createElement('ul', { 'data-bind': 'foreach: items' },
      createElement('li', { 'data-bind': 'text: $data' }),
    );
    applyBindings({ items }, ul);
    expect(ul.querySelectorAll('li').length).toBe(2);

    items.set(['X', 'Y', 'Z']);
    expect(ul.querySelectorAll('li').length).toBe(3);
    expect(ul.querySelectorAll('li')[0].textContent).toBe('X');
    expect(ul.querySelectorAll('li')[1].textContent).toBe('Y');
    expect(ul.querySelectorAll('li')[2].textContent).toBe('Z');
  });

  it('supports the "as" alias', () => {
    const ul = createElement('ul', { 'data-bind': "foreach: { data: items, as: 'item' }" },
      createElement('li', { 'data-bind': 'text: item' }),
    );
    applyBindings({ items: ['one', 'two'] }, ul);
    const lis = ul.querySelectorAll('li');
    expect(lis.length).toBe(2);
    expect(lis[0].textContent).toBe('one');
    expect(lis[1].textContent).toBe('two');
  });

  it('provides $index in the binding context', () => {
    const ul = createElement('ul', { 'data-bind': 'foreach: items' },
      createElement('li', { 'data-bind': 'text: $index' }),
    );
    applyBindings({ items: ['A', 'B', 'C'] }, ul);
    const lis = ul.querySelectorAll('li');
    expect(lis[0].textContent).toBe('0');
    expect(lis[1].textContent).toBe('1');
    expect(lis[2].textContent).toBe('2');
  });

  it('provides $parent in child context', () => {
    const ul = createElement('ul', { 'data-bind': 'foreach: items' },
      createElement('li', { 'data-bind': 'text: $parent.label' }),
    );
    applyBindings({ items: ['A'], label: 'list' }, ul);
    expect(ul.querySelector('li')!.textContent).toBe('list');
  });

  it('works with virtual elements', () => {
    const container = createElement('div');
    container.appendChild(createComment(' tap foreach: items ') as never);
    container.appendChild(createElement('span', { 'data-bind': 'text: $data' }) as never);
    container.appendChild(createComment(' /tap ') as never);

    applyBindings({ items: ['X', 'Y'] }, container);
    const spans = container.querySelectorAll('span');
    expect(spans.length).toBe(2);
    expect(spans[0].textContent).toBe('X');
    expect(spans[1].textContent).toBe('Y');
  });

  it('handles ObservableArray push with virtual elements', () => {
    const items = new ObservableArray(['A']);
    const container = createElement('div');
    container.appendChild(createComment(' tap foreach: items ') as never);
    container.appendChild(createElement('span', { 'data-bind': 'text: $data' }) as never);
    container.appendChild(createComment(' /tap ') as never);

    applyBindings({ items }, container);
    expect(container.querySelectorAll('span').length).toBe(1);

    items.push('B');
    expect(container.querySelectorAll('span').length).toBe(2);
    expect(container.querySelectorAll('span')[1].textContent).toBe('B');
  });

  it('updates $index when items are removed from the beginning', () => {
    const items = new ObservableArray(['A', 'B', 'C']);
    const ul = createElement('ul', { 'data-bind': 'foreach: items' },
      createElement('li', { 'data-bind': 'text: $index' }),
    );
    applyBindings({ items }, ul);
    expect(ul.querySelectorAll('li')[0].textContent).toBe('0');
    expect(ul.querySelectorAll('li')[1].textContent).toBe('1');
    expect(ul.querySelectorAll('li')[2].textContent).toBe('2');

    items.shift();
    const lis = ul.querySelectorAll('li');
    expect(lis.length).toBe(2);
    expect(lis[0].textContent).toBe('0');
    expect(lis[1].textContent).toBe('1');
  });

  it('handles object form with observable array data', () => {
    const items = new ObservableArray(['hello', 'world']);
    const ul = createElement('ul', { 'data-bind': "foreach: { data: items, as: 'val' }" },
      createElement('li', { 'data-bind': 'text: val' }),
    );
    applyBindings({ items }, ul);
    expect(ul.querySelectorAll('li').length).toBe(2);
    expect(ul.querySelectorAll('li')[0].textContent).toBe('hello');
    expect(ul.querySelectorAll('li')[1].textContent).toBe('world');

    items.push('!');
    expect(ul.querySelectorAll('li').length).toBe(3);
    expect(ul.querySelectorAll('li')[2].textContent).toBe('!');
  });
});
