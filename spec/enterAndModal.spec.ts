import { Window } from 'happy-dom';
import {
  applyBindings,
  cleanNode,
  Observable,
  enableNamespacedBindings,
} from '#src/index.js';

enableNamespacedBindings();

const window = new Window();
const document = window.document;

function createElement(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  return el as unknown as Element;
}

interface KeyModifiers { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean }

function fireKeydown(el: Element, key: string, modifiers: KeyModifiers = {}): void {
  const EventCtor = (el.ownerDocument?.defaultView as unknown as typeof globalThis)?.KeyboardEvent ?? KeyboardEvent;
  el.dispatchEvent(new EventCtor('keydown', { key, bubbles: true, ...modifiers } as KeyboardEventInit));
}

function fireKeyup(el: Element, key: string, modifiers: KeyModifiers = {}): void {
  const EventCtor = (el.ownerDocument?.defaultView as unknown as typeof globalThis)?.KeyboardEvent ?? KeyboardEvent;
  el.dispatchEvent(new EventCtor('keyup', { key, bubbles: true, ...modifiers } as KeyboardEventInit));
}

// ---- enter binding ----

describe('enter binding', () => {
  it('calls the callback when Enter is pressed', () => {
    const spy = jasmine.createSpy('enterCallback');
    const el = createElement('input', { 'data-bind': 'enter: onEnter' });
    document.body.appendChild(el as never);

    applyBindings({ onEnter: spy }, el);

    fireKeydown(el, 'Enter');
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('does not call the callback for other keys', () => {
    const spy = jasmine.createSpy('enterCallback');
    const el = createElement('input', { 'data-bind': 'enter: onEnter' });
    document.body.appendChild(el as never);

    applyBindings({ onEnter: spy }, el);

    fireKeydown(el, 'Escape');
    fireKeydown(el, 'a');
    fireKeydown(el, 'Tab');
    expect(spy).not.toHaveBeenCalled();

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('passes $data and event to the callback', () => {
    let receivedData: unknown;
    let receivedEvent: Event | undefined;
    const vm = {
      onEnter: (_data: unknown, evt: Event) => { receivedData = _data; receivedEvent = evt; },
    };
    const el = createElement('input', { 'data-bind': 'enter: onEnter' });
    document.body.appendChild(el as never);

    applyBindings(vm, el);

    fireKeydown(el, 'Enter');
    expect(receivedEvent).toBeDefined();
    expect((receivedEvent as KeyboardEvent).key).toBe('Enter');
    expect(receivedData).toBe(vm);

    cleanNode(el);
    document.body.removeChild(el as never);
  });
});

// ---- keydown binding ----

describe('keydown binding', () => {
  it('keydown.enter calls handler on Enter', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keydown.enter: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeydown(el, 'Enter');
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('keydown.enter ignores other keys', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keydown.enter: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeydown(el, 'Escape');
    fireKeydown(el, 'a');
    fireKeydown(el, 'Tab');
    expect(spy).not.toHaveBeenCalled();

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('keydown.esc calls handler on Escape', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keydown.esc: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeydown(el, 'Escape');
    expect(spy).toHaveBeenCalledTimes(1);

    fireKeydown(el, 'Enter');
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('keydown.tab calls handler on Tab', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keydown.tab: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeydown(el, 'Tab');
    expect(spy).toHaveBeenCalledTimes(1);

    fireKeydown(el, 'Enter');
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('keydown.enter.ctrl fires only when Enter + ctrlKey', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keydown.enter.ctrl: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeydown(el, 'Enter');
    expect(spy).not.toHaveBeenCalled();

    fireKeydown(el, 'Enter', { ctrlKey: true });
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('keydown.s.ctrl works for single-letter key + modifier', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keydown.s.ctrl: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeydown(el, 's');
    expect(spy).not.toHaveBeenCalled();

    fireKeydown(el, 's', { ctrlKey: true });
    expect(spy).toHaveBeenCalledTimes(1);

    fireKeydown(el, 'a', { ctrlKey: true });
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('keydown.enter.ctrl.shift requires both modifiers', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keydown.enter.ctrl.shift: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeydown(el, 'Enter', { ctrlKey: true });
    expect(spy).not.toHaveBeenCalled();

    fireKeydown(el, 'Enter', { shiftKey: true });
    expect(spy).not.toHaveBeenCalled();

    fireKeydown(el, 'Enter', { ctrlKey: true, shiftKey: true });
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('calls preventDefault unless handler returns true', () => {
    const el = createElement('input', { 'data-bind': 'keydown.enter: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: () => {} }, el);

    const EventCtor = (el.ownerDocument?.defaultView as unknown as typeof globalThis)?.KeyboardEvent ?? KeyboardEvent;
    const event = new EventCtor('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    spyOn(event, 'preventDefault');
    el.dispatchEvent(event);
    expect(event.preventDefault).toHaveBeenCalled();

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('does not call preventDefault when handler returns true', () => {
    const el = createElement('input', { 'data-bind': 'keydown.enter: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: () => true }, el);

    const EventCtor = (el.ownerDocument?.defaultView as unknown as typeof globalThis)?.KeyboardEvent ?? KeyboardEvent;
    const event = new EventCtor('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    spyOn(event, 'preventDefault');
    el.dispatchEvent(event);
    expect(event.preventDefault).not.toHaveBeenCalled();

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('passes $data as this and first argument', () => {
    let receivedThis: unknown;
    let receivedData: unknown;
    const vm = {
      handler: function (this: unknown, data: unknown) { receivedThis = this; receivedData = data; },
    };
    const el = createElement('input', { 'data-bind': 'keydown.enter: handler' });
    document.body.appendChild(el as never);

    applyBindings(vm, el);

    fireKeydown(el, 'Enter');
    expect(receivedThis).toBe(vm);
    expect(receivedData).toBe(vm);

    cleanNode(el);
    document.body.removeChild(el as never);
  });
});

// ---- keyup binding ----

describe('keyup binding', () => {
  it('keyup.space calls handler on Space keyup', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keyup.space: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeyup(el, ' ');
    expect(spy).toHaveBeenCalledTimes(1);

    fireKeyup(el, 'Enter');
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('keyup.esc.alt fires only with alt modifier', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keyup.esc.alt: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeyup(el, 'Escape');
    expect(spy).not.toHaveBeenCalled();

    fireKeyup(el, 'Escape', { altKey: true });
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('does not fire on keydown events', () => {
    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keyup.enter: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    fireKeydown(el, 'Enter');
    expect(spy).not.toHaveBeenCalled();

    fireKeyup(el, 'Enter');
    expect(spy).toHaveBeenCalledTimes(1);

    cleanNode(el);
    document.body.removeChild(el as never);
  });
});

// ---- modal binding ----

describe('modal binding', () => {
  it('calls showModal when bound to a truthy value', () => {
    const dlg = createElement('dialog', { 'data-bind': 'modal: isOpen' }) as unknown as HTMLDialogElement;
    document.body.appendChild(dlg as never);

    spyOn(dlg, 'showModal');

    applyBindings({ isOpen: true }, dlg as unknown as Element);

    expect(dlg.showModal).toHaveBeenCalled();

    cleanNode(dlg as unknown as Node);
    document.body.removeChild(dlg as never);
  });

  it('does not call showModal when bound to a falsy value', () => {
    const dlg = createElement('dialog', { 'data-bind': 'modal: isOpen' }) as unknown as HTMLDialogElement;
    document.body.appendChild(dlg as never);

    spyOn(dlg, 'showModal');
    spyOn(dlg, 'close');

    applyBindings({ isOpen: false }, dlg as unknown as Element);

    expect(dlg.showModal).not.toHaveBeenCalled();

    cleanNode(dlg as unknown as Node);
    document.body.removeChild(dlg as never);
  });

  it('opens and closes reactively when the observable changes', () => {
    const isOpen = new Observable(false);
    const dlg = createElement('dialog', { 'data-bind': 'modal: isOpen' }) as unknown as HTMLDialogElement;
    document.body.appendChild(dlg as never);

    spyOn(dlg, 'showModal').and.callFake(() => {
      Object.defineProperty(dlg, 'open', { value: true, writable: true, configurable: true });
    });
    spyOn(dlg, 'close').and.callFake(() => {
      Object.defineProperty(dlg, 'open', { value: false, writable: true, configurable: true });
    });

    applyBindings({ isOpen }, dlg as unknown as Element);

    expect(dlg.showModal).not.toHaveBeenCalled();

    isOpen.set(true);
    expect(dlg.showModal).toHaveBeenCalledTimes(1);

    isOpen.set(false);
    expect(dlg.close).toHaveBeenCalledTimes(1);

    cleanNode(dlg as unknown as Node);
    document.body.removeChild(dlg as never);
  });

  it('does not call showModal again if already open', () => {
    const isOpen = new Observable(true);
    const dlg = createElement('dialog', { 'data-bind': 'modal: isOpen' }) as unknown as HTMLDialogElement;
    document.body.appendChild(dlg as never);

    spyOn(dlg, 'showModal').and.callFake(() => {
      Object.defineProperty(dlg, 'open', { value: true, writable: true, configurable: true });
    });

    applyBindings({ isOpen }, dlg as unknown as Element);

    expect(dlg.showModal).toHaveBeenCalledTimes(1);

    isOpen.set(true);
    expect(dlg.showModal).toHaveBeenCalledTimes(1);

    cleanNode(dlg as unknown as Node);
    document.body.removeChild(dlg as never);
  });
});
