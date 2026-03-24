import { Window } from 'happy-dom';
import {
  applyBindings,
  cleanNode,
  Observable,
} from '#src/index.js';

const window = new Window();
const document = window.document;

function createElement(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  return el as unknown as Element;
}

function fireKeydown(el: Element, key: string): void {
  const EventCtor = (el.ownerDocument?.defaultView as unknown as typeof globalThis)?.KeyboardEvent ?? KeyboardEvent;
  el.dispatchEvent(new EventCtor('keydown', { key, bubbles: true } as KeyboardEventInit));
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

  it('passes the event to the callback', () => {
    let receivedEvent: Event | undefined;
    const el = createElement('input', { 'data-bind': 'enter: onEnter' });
    document.body.appendChild(el as never);

    applyBindings({ onEnter: (evt: Event) => { receivedEvent = evt; } }, el);

    fireKeydown(el, 'Enter');
    expect(receivedEvent).toBeDefined();
    expect((receivedEvent as KeyboardEvent).key).toBe('Enter');

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
