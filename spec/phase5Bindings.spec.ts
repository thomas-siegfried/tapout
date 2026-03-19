import { Window } from 'happy-dom';
import {
  applyBindings,
  applyBindingsToNode,
  bindingHandlers,
  Observable,
  ObservableArray,
  twoWayBindings,
  selectExtensions,
} from '#src/index.js';

const window = new Window();
const document = window.document;

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: Node[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  for (const child of children) el.appendChild(child as never);
  return el as unknown as HTMLElementTagNameMap[K];
}

function fireEvent(el: Element | Node, eventName: string, options?: EventInit): void {
  const event = new (window as unknown as typeof globalThis).Event(eventName, { bubbles: true, cancelable: true, ...options }) as unknown as Event;
  (el as Element).dispatchEvent(event);
}

// ===========================================================================
// Task 20: Event bindings
// ===========================================================================

describe('event binding', () => {
  it('calls handler on event with $data as first arg', () => {
    const handler = jasmine.createSpy('clickHandler');
    const el = createElement('button', { 'data-bind': 'event: { click: handler }' });
    const vm = { handler };
    applyBindings(vm, el);

    fireEvent(el, 'click');
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.calls.first().object).toBe(vm);
    expect(handler.calls.first().args[0]).toBe(vm);
  });

  it('prevents default unless handler returns true', () => {
    const handler = jasmine.createSpy('handler').and.returnValue(false);
    const el = createElement('button');
    applyBindingsToNode(el, { event: { click: handler } }, {});

    const event = new (window as unknown as typeof globalThis).Event('click', { cancelable: true }) as unknown as Event;
    (el as unknown as Element).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not prevent default when handler returns true', () => {
    const handler = jasmine.createSpy('handler').and.returnValue(true);
    const el = createElement('button');
    applyBindingsToNode(el, { event: { click: handler } }, {});

    const event = new (window as unknown as typeof globalThis).Event('click', { cancelable: true }) as unknown as Event;
    (el as unknown as Element).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('handles multiple events', () => {
    const clickSpy = jasmine.createSpy('click');
    const mouseoverSpy = jasmine.createSpy('mouseover');
    const el = createElement('div');
    applyBindingsToNode(el, { event: { click: clickSpy, mouseover: mouseoverSpy } }, {});

    fireEvent(el, 'click');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(mouseoverSpy).not.toHaveBeenCalled();

    fireEvent(el, 'mouseover');
    expect(mouseoverSpy).toHaveBeenCalledTimes(1);
  });

  it('stops propagation when <event>Bubble is false', () => {
    const handler = jasmine.createSpy('handler').and.returnValue(true);
    const el = createElement('button');
    applyBindingsToNode(el, { event: { click: handler }, clickBubble: false }, {});

    const event = new (window as unknown as typeof globalThis).Event('click', { bubbles: true, cancelable: true }) as unknown as Event;
    const stopSpy = spyOn(event as Event, 'stopPropagation');
    (el as unknown as Element).dispatchEvent(event);
    expect(stopSpy).toHaveBeenCalled();
  });
});

describe('click binding', () => {
  it('calls handler on click', () => {
    const handler = jasmine.createSpy('clickHandler');
    const el = createElement('button', { 'data-bind': 'click: handler' });
    applyBindings({ handler }, el);

    fireEvent(el, 'click');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('is a shorthand for event: { click: handler }', () => {
    const handler = jasmine.createSpy('clickHandler').and.returnValue(true);
    const el = createElement('button');
    applyBindingsToNode(el, { click: handler }, { x: 1 });

    fireEvent(el, 'click');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('passes viewModel as this and first arg', () => {
    const vm = {
      handler: jasmine.createSpy('handler'),
    };
    const el = createElement('button', { 'data-bind': 'click: handler' });
    applyBindings(vm, el);

    fireEvent(el, 'click');
    expect(vm.handler.calls.first().object).toBe(vm);
    expect(vm.handler.calls.first().args[0]).toBe(vm);
  });
});

describe('submit binding', () => {
  it('calls handler on submit', () => {
    const handler = jasmine.createSpy('submitHandler');
    const form = createElement('form', { 'data-bind': 'submit: handler' });
    applyBindings({ handler }, form);

    fireEvent(form, 'submit');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('throws if value is not a function', () => {
    const el = createElement('form');
    expect(() => {
      applyBindingsToNode(el, { submit: 'not a function' });
    }).toThrowError(/must be a function/);
  });

  it('prevents default unless handler returns true', () => {
    const handler = jasmine.createSpy('handler').and.returnValue(false);
    const form = createElement('form');
    applyBindingsToNode(form, { submit: handler }, {});

    const event = new (window as unknown as typeof globalThis).Event('submit', { cancelable: true }) as unknown as Event;
    (form as unknown as Element).dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('passes element as argument and $data as this', () => {
    const vm = { handler: jasmine.createSpy('handler') };
    const form = createElement('form', { 'data-bind': 'submit: handler' });
    applyBindings(vm, form);

    fireEvent(form, 'submit');
    expect(vm.handler.calls.first().object).toBe(vm);
    expect(vm.handler.calls.first().args[0]).toBe(form);
  });
});

// ===========================================================================
// Task 21: value binding
// ===========================================================================

describe('value binding', () => {
  it('sets the element value from model', () => {
    const el = createElement('input', { 'data-bind': 'value: val' });
    applyBindings({ val: 'hello' }, el);
    expect(el.value).toBe('hello');
  });

  it('updates element when observable changes', () => {
    const val = new Observable('initial');
    const el = createElement('input', { 'data-bind': 'value: val' });
    applyBindings({ val }, el);
    expect(el.value).toBe('initial');

    val.set('updated');
    expect(el.value).toBe('updated');
  });

  it('updates model on change event', () => {
    const val = new Observable('before');
    const el = createElement('input', { 'data-bind': 'value: val' });
    applyBindings({ val }, el);

    el.value = 'after';
    fireEvent(el, 'change');
    expect(val.peek()).toBe('after');
  });

  it('handles null/undefined as empty string', () => {
    const val = new Observable<string | null>('test');
    const el = createElement('input', { 'data-bind': 'value: val' });
    applyBindings({ val }, el);
    expect(el.value).toBe('test');

    val.set(null);
    expect(el.value).toBe('');
  });

  it('registers as a two-way binding', () => {
    expect(twoWayBindings['value']).toBe(true);
  });

  it('works with textarea', () => {
    const val = new Observable('text content');
    const el = createElement('textarea', { 'data-bind': 'value: val' });
    applyBindings({ val }, el);
    expect(el.value).toBe('text content');
  });
});

// ===========================================================================
// Task 22: textInput binding
// ===========================================================================

describe('textInput binding', () => {
  it('sets the element value from model', () => {
    const el = createElement('input', { 'data-bind': 'textInput: val' });
    applyBindings({ val: 'hello' }, el);
    expect(el.value).toBe('hello');
  });

  it('updates element when observable changes', () => {
    const val = new Observable('initial');
    const el = createElement('input', { 'data-bind': 'textInput: val' });
    applyBindings({ val }, el);

    val.set('updated');
    expect(el.value).toBe('updated');
  });

  it('updates model on input event', () => {
    const val = new Observable('before');
    const el = createElement('input', { 'data-bind': 'textInput: val' });
    applyBindings({ val }, el);

    el.value = 'typed';
    fireEvent(el, 'input');
    expect(val.peek()).toBe('typed');
  });

  it('updates model on change event', () => {
    const val = new Observable('before');
    const el = createElement('input', { 'data-bind': 'textInput: val' });
    applyBindings({ val }, el);

    el.value = 'changed';
    fireEvent(el, 'change');
    expect(val.peek()).toBe('changed');
  });

  it('updates model on blur event', () => {
    const val = new Observable('before');
    const el = createElement('input', { 'data-bind': 'textInput: val' });
    applyBindings({ val }, el);

    el.value = 'blurred';
    fireEvent(el, 'blur');
    expect(val.peek()).toBe('blurred');
  });

  it('handles null model value as empty string', () => {
    const val = new Observable<string | null>('test');
    const el = createElement('input', { 'data-bind': 'textInput: val' });
    applyBindings({ val }, el);

    val.set(null);
    expect(el.value).toBe('');
  });

  it('handles undefined model value as empty string', () => {
    const val = new Observable<string | undefined>('test');
    const el = createElement('input', { 'data-bind': 'textInput: val' });
    applyBindings({ val }, el);

    val.set(undefined);
    expect(el.value).toBe('');
  });

  it('registers as a two-way binding', () => {
    expect(twoWayBindings['textInput']).toBe(true);
  });

  it('textinput is an alias for textInput via preprocess', () => {
    const handler = bindingHandlers['textinput'];
    expect(handler).toBeDefined();
    expect(handler.preprocess).toBeDefined();
  });

  it('works with textarea elements', () => {
    const val = new Observable('textarea content');
    const el = createElement('textarea', { 'data-bind': 'textInput: val' });
    applyBindings({ val }, el);
    expect(el.value).toBe('textarea content');

    el.value = 'new content';
    fireEvent(el, 'input');
    expect(val.peek()).toBe('new content');
  });
});

// ===========================================================================
// Task 23: checked / checkedValue bindings
// ===========================================================================

describe('checked binding', () => {
  it('sets checkbox checked state from truthy model value', () => {
    const el = createElement('input', { type: 'checkbox', 'data-bind': 'checked: isOn' });
    applyBindings({ isOn: true }, el);
    expect(el.checked).toBe(true);
  });

  it('sets checkbox unchecked for falsy model value', () => {
    const el = createElement('input', { type: 'checkbox', 'data-bind': 'checked: isOn' });
    applyBindings({ isOn: false }, el);
    expect(el.checked).toBe(false);
  });

  it('updates checkbox reactively', () => {
    const isOn = new Observable(false);
    const el = createElement('input', { type: 'checkbox', 'data-bind': 'checked: isOn' });
    applyBindings({ isOn }, el);
    expect(el.checked).toBe(false);

    isOn.set(true);
    expect(el.checked).toBe(true);
  });

  it('updates model when checkbox is clicked', () => {
    const isOn = new Observable(false);
    const el = createElement('input', { type: 'checkbox', 'data-bind': 'checked: isOn' });
    applyBindings({ isOn }, el);

    el.checked = true;
    fireEvent(el, 'click');
    expect(isOn.peek()).toBe(true);
  });

  it('works with radio buttons', () => {
    const selected = new Observable('a');
    const elA = createElement('input', { type: 'radio', value: 'a', 'data-bind': 'checked: selected' });
    const elB = createElement('input', { type: 'radio', value: 'b', 'data-bind': 'checked: selected' });
    const container = createElement('div');
    container.appendChild(elA as unknown as Node);
    container.appendChild(elB as unknown as Node);
    applyBindings({ selected }, container);

    expect(elA.checked).toBe(true);
    expect(elB.checked).toBe(false);

    selected.set('b');
    expect(elA.checked).toBe(false);
    expect(elB.checked).toBe(true);
  });

  it('handles checkbox bound to array (adds/removes values)', () => {
    const selection = new ObservableArray(['a']);
    const elA = createElement('input', { type: 'checkbox', value: 'a', 'data-bind': 'checked: selection' });
    const elB = createElement('input', { type: 'checkbox', value: 'b', 'data-bind': 'checked: selection' });
    const container = createElement('div');
    container.appendChild(elA as unknown as Node);
    container.appendChild(elB as unknown as Node);
    applyBindings({ selection }, container);

    expect(elA.checked).toBe(true);
    expect(elB.checked).toBe(false);

    elB.checked = true;
    fireEvent(elB, 'click');
    expect(selection.peek()).toContain('b');
    expect(selection.peek()).toContain('a');
  });

  it('assigns uniqueName to radios without a name', () => {
    const selected = new Observable('x');
    const el = createElement('input', { type: 'radio', value: 'x', 'data-bind': 'checked: selected' });
    applyBindings({ selected }, el);
    expect(el.name).toMatch(/^tap_unique_\d+$/);
  });

  it('registers as a two-way binding', () => {
    expect(twoWayBindings['checked']).toBe(true);
  });

  it('has after dependency on value and attr', () => {
    expect(bindingHandlers['checked'].after).toEqual(['value', 'attr']);
  });

  it('does nothing for non-checkbox/radio elements', () => {
    const el = createElement('input', { type: 'text', 'data-bind': 'checked: val' });
    expect(() => applyBindings({ val: true }, el)).not.toThrow();
  });
});

describe('checkedValue binding', () => {
  it('sets element value from model', () => {
    const el = createElement('input', { type: 'checkbox' });
    applyBindingsToNode(el, { checkedValue: 'myVal' });
    expect(el.value).toBe('myVal');
  });

  it('updates element value reactively', () => {
    const val = new Observable('first');
    const el = createElement('input', { type: 'checkbox' });
    applyBindingsToNode(el, { checkedValue: val });
    expect(el.value).toBe('first');

    val.set('second');
    expect(el.value).toBe('second');
  });
});

// ===========================================================================
// Task 24: hasfocus / hasFocus bindings
// ===========================================================================

describe('hasfocus binding', () => {
  it('registers as a two-way binding', () => {
    expect(twoWayBindings['hasfocus']).toBe(true);
  });

  it('handler is registered', () => {
    expect(bindingHandlers['hasfocus']).toBeDefined();
    expect(bindingHandlers['hasfocus'].init).toBeDefined();
    expect(bindingHandlers['hasfocus'].update).toBeDefined();
  });
});

describe('hasFocus binding', () => {
  it('is an alias for hasfocus', () => {
    expect(bindingHandlers['hasFocus']).toBe(bindingHandlers['hasfocus']);
  });

  it('twoWayBindings maps to hasfocus', () => {
    expect(twoWayBindings['hasFocus']).toBe('hasfocus');
  });
});

// ===========================================================================
// Task 25: selectedOptions binding
// ===========================================================================

describe('selectedOptions binding', () => {
  it('registers as a two-way binding', () => {
    expect(twoWayBindings['selectedOptions']).toBe(true);
  });

  it('throws if not applied to a select element', () => {
    const el = createElement('div');
    expect(() => {
      applyBindingsToNode(el, { selectedOptions: [] });
    }).toThrowError(/SELECT/);
  });

  it('selects options based on model array', () => {
    const sel = new Observable(['b', 'c']);
    const select = createElement('select', {
      multiple: '',
      'data-bind': 'selectedOptions: sel',
    });
    const optA = createElement('option', { value: 'a' });
    optA.textContent = 'A';
    const optB = createElement('option', { value: 'b' });
    optB.textContent = 'B';
    const optC = createElement('option', { value: 'c' });
    optC.textContent = 'C';
    select.appendChild(optA as unknown as Node);
    select.appendChild(optB as unknown as Node);
    select.appendChild(optC as unknown as Node);

    const container = createElement('div');
    container.appendChild(select as unknown as Node);
    applyBindings({ sel }, container);

    expect(optA.selected).toBe(false);
    expect(optB.selected).toBe(true);
    expect(optC.selected).toBe(true);
  });

  it('updates model when selection changes', () => {
    const sel = new Observable<string[]>([]);
    const select = createElement('select', {
      multiple: '',
      'data-bind': 'selectedOptions: sel',
    });
    const optA = createElement('option', { value: 'a' });
    optA.textContent = 'A';
    const optB = createElement('option', { value: 'b' });
    optB.textContent = 'B';
    select.appendChild(optA as unknown as Node);
    select.appendChild(optB as unknown as Node);

    const container = createElement('div');
    container.appendChild(select as unknown as Node);
    applyBindings({ sel }, container);

    optA.selected = true;
    optB.selected = false;
    fireEvent(select, 'change');

    expect(sel.peek()).toEqual(['a']);
  });
});

// ===========================================================================
// Task 26: options binding
// ===========================================================================

describe('options binding', () => {
  it('populates select with options from array', () => {
    const el = createElement('select', { 'data-bind': 'options: items' });
    applyBindings({ items: ['a', 'b', 'c'] }, el);

    expect(el.options.length).toBe(3);
    expect(el.options[0].value).toBe('a');
    expect(el.options[1].value).toBe('b');
    expect(el.options[2].value).toBe('c');
  });

  it('clears existing options before applying', () => {
    const el = createElement('select');
    const existing = createElement('option', { value: 'old' });
    el.appendChild(existing as unknown as Node);

    applyBindingsToNode(el, { options: ['new'] });
    expect(el.options.length).toBe(1);
    expect(el.options[0].value).toBe('new');
  });

  it('updates options reactively', () => {
    const items = new Observable(['x', 'y']);
    const el = createElement('select', { 'data-bind': 'options: items' });
    applyBindings({ items }, el);
    expect(el.options.length).toBe(2);

    items.set(['a', 'b', 'c']);
    expect(el.options.length).toBe(3);
    expect(el.options[0].value).toBe('a');
  });

  it('throws if applied to non-select element', () => {
    const el = createElement('div');
    expect(() => {
      applyBindingsToNode(el, { options: ['a'] });
    }).toThrowError(/SELECT/);
  });

  it('supports optionsText', () => {
    const items = [
      { name: 'Alice', id: 1 },
      { name: 'Bob', id: 2 },
    ];
    const el = createElement('select');
    applyBindingsToNode(el, { options: items, optionsText: 'name' });

    expect(el.options[0].textContent).toBe('Alice');
    expect(el.options[1].textContent).toBe('Bob');
  });

  it('supports optionsValue', () => {
    const items = [
      { name: 'Alice', id: 1 },
      { name: 'Bob', id: 2 },
    ];
    const el = createElement('select');
    applyBindingsToNode(el, { options: items, optionsValue: 'id' });

    expect(el.options[0].value).toBe('1');
    expect(el.options[1].value).toBe('2');
  });

  it('supports optionsText as a function', () => {
    const items = [{ first: 'A', last: 'B' }];
    const el = createElement('select');
    applyBindingsToNode(el, {
      options: items,
      optionsText: (item: { first: string; last: string }) => `${item.first} ${item.last}`,
    });

    expect(el.options[0].textContent).toBe('A B');
  });

  it('supports optionsCaption', () => {
    const el = createElement('select');
    applyBindingsToNode(el, { options: ['a', 'b'], optionsCaption: '-- Pick one --' });

    expect(el.options.length).toBe(3);
    expect(el.options[0].textContent).toBe('-- Pick one --');
    expect(el.options[1].value).toBe('a');
  });

  it('does not show caption when optionsCaption is null', () => {
    const el = createElement('select');
    applyBindingsToNode(el, { options: ['a'], optionsCaption: null });
    expect(el.options.length).toBe(1);
  });

  it('filters out destroyed items by default', () => {
    const items = [
      { text: 'a' },
      { text: 'b', _destroy: true },
      { text: 'c' },
    ];
    const el = createElement('select');
    applyBindingsToNode(el, { options: items, optionsText: 'text' });

    expect(el.options.length).toBe(2);
    expect(el.options[0].textContent).toBe('a');
    expect(el.options[1].textContent).toBe('c');
  });

  it('includes destroyed items when optionsIncludeDestroyed is true', () => {
    const items = [
      { text: 'a' },
      { text: 'b', _destroy: true },
    ];
    const el = createElement('select');
    applyBindingsToNode(el, { options: items, optionsText: 'text', optionsIncludeDestroyed: true });

    expect(el.options.length).toBe(2);
  });

  it('controls descendant bindings', () => {
    const handler = bindingHandlers['options'];
    expect(handler.init).toBeDefined();
    const result = handler.init!(
      createElement('select') as Node, () => [], {} as never, undefined, {} as never,
    );
    expect(result).toEqual({ controlsDescendantBindings: true });
  });

  it('supports optionsAfterRender callback', () => {
    const afterRender = jasmine.createSpy('afterRender');
    const items = ['x', 'y'];
    const el = createElement('select');
    applyBindingsToNode(el, { options: items, optionsAfterRender: afterRender });

    expect(afterRender).toHaveBeenCalledTimes(2);
    expect(afterRender.calls.argsFor(0)[1]).toBe('x');
    expect(afterRender.calls.argsFor(1)[1]).toBe('y');
  });

  it('handles empty/null array', () => {
    const el = createElement('select');
    applyBindingsToNode(el, { options: null });
    expect(el.options.length).toBe(0);
  });

  it('handles single non-array value', () => {
    const el = createElement('select');
    applyBindingsToNode(el, { options: 'single' as unknown });
    expect(el.options.length).toBe(1);
  });
});

// ===========================================================================
// selectExtensions
// ===========================================================================

describe('selectExtensions', () => {
  describe('readValue', () => {
    it('reads input value', () => {
      const el = createElement('input');
      el.value = 'hello';
      expect(selectExtensions.readValue(el)).toBe('hello');
    });

    it('reads option value', () => {
      const el = createElement('option', { value: 'opt1' });
      expect(selectExtensions.readValue(el)).toBe('opt1');
    });

    it('reads select value via selected option', () => {
      const select = createElement('select');
      const opt = createElement('option', { value: 'selected' });
      select.appendChild(opt as unknown as Node);
      (select as unknown as HTMLSelectElement).selectedIndex = 0;
      expect(selectExtensions.readValue(select)).toBe('selected');
    });

    it('returns undefined for select with no selection', () => {
      const select = createElement('select');
      (select as unknown as HTMLSelectElement).selectedIndex = -1;
      expect(selectExtensions.readValue(select)).toBeUndefined();
    });
  });

  describe('writeValue', () => {
    it('writes string to option element', () => {
      const opt = createElement('option');
      selectExtensions.writeValue(opt, 'test');
      expect(opt.value).toBe('test');
    });

    it('writes to input element', () => {
      const input = createElement('input');
      selectExtensions.writeValue(input, 'hello');
      expect(input.value).toBe('hello');
    });

    it('converts null to empty string for input', () => {
      const input = createElement('input');
      input.value = 'test';
      selectExtensions.writeValue(input, null);
      expect(input.value).toBe('');
    });

    it('stores non-string values on option via domData', () => {
      const opt = createElement('option');
      const obj = { id: 1, name: 'test' };
      selectExtensions.writeValue(opt, obj);

      const readBack = selectExtensions.readValue(opt);
      expect(readBack).toBe(obj);
    });

    it('selects matching option in select element', () => {
      const select = createElement('select');
      const opt1 = createElement('option', { value: 'a' });
      const opt2 = createElement('option', { value: 'b' });
      select.appendChild(opt1 as unknown as Node);
      select.appendChild(opt2 as unknown as Node);

      selectExtensions.writeValue(select, 'b');
      expect((select as unknown as HTMLSelectElement).selectedIndex).toBe(1);
    });
  });
});
