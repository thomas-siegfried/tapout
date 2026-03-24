import { addDisposeCallback } from './domNodeDisposal.js';

export type EventCallback<T> = (value: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Constructor<T> = abstract new (...args: any[]) => T;

interface SubscriptionEntry<T> {
  callback: EventCallback<T>;
  disposed: boolean;
}

export class EventSubscription {
  private _disposeCallback: (() => void) | null;
  private _isDisposed = false;

  constructor(disposeCallback: () => void) {
    this._disposeCallback = disposeCallback;
  }

  dispose(): void {
    if (!this._isDisposed) {
      this._isDisposed = true;
      this._disposeCallback!();
      this._disposeCallback = null;
    }
  }

  get closed(): boolean {
    return this._isDisposed;
  }

  disposeWhenNodeIsRemoved(node: Node): void {
    addDisposeCallback(node, () => this.dispose());
  }
}

export class EventSubscribable<T = unknown> {
  #entries: SubscriptionEntry<T>[] = [];
  #isDisposed = false;

  subscribe(callback: EventCallback<T>): EventSubscription {
    if (this.#isDisposed) {
      throw new Error('EventSubscribable is disposed');
    }
    const entry: SubscriptionEntry<T> = { callback, disposed: false };
    this.#entries.push(entry);
    return new EventSubscription(() => {
      entry.disposed = true;
      const idx = this.#entries.indexOf(entry);
      if (idx !== -1) {
        this.#entries.splice(idx, 1);
      }
    });
  }

  on<U extends T>(type: Constructor<U>): EventSubscribable<U> {
    return new FilteredEventSubscribable<T, U>(this, type);
  }

  get subscriberCount(): number {
    return this.#entries.length;
  }

  /** @internal */
  _emit(value: T): void {
    if (this.#isDisposed) return;
    const snapshot = this.#entries.slice();
    for (let i = 0; i < snapshot.length; i++) {
      if (!snapshot[i].disposed) {
        snapshot[i].callback(value);
      }
    }
  }

  /** @internal */
  _dispose(): void {
    this.#isDisposed = true;
    this.#entries.length = 0;
  }
}

class FilteredEventSubscribable<T, U extends T> extends EventSubscribable<U> {
  private _parent: EventSubscribable<T>;
  private _type: Constructor<U>;

  constructor(parent: EventSubscribable<T>, type: Constructor<U>) {
    super();
    this._parent = parent;
    this._type = type;
  }

  override subscribe(callback: EventCallback<U>): EventSubscription {
    return this._parent.subscribe((value: T) => {
      if (value instanceof this._type) {
        callback(value as U);
      }
    });
  }

  override on<V extends U>(type: Constructor<V>): EventSubscribable<V> {
    return new FilteredEventSubscribable<T, V>(this._parent, type);
  }
}

export class Event<T = unknown> {
  private _subscribable: EventSubscribable<T>;
  private _isDisposed = false;

  constructor() {
    this._subscribable = new EventSubscribable<T>();
  }

  get subscribable(): EventSubscribable<T> {
    return this._subscribable;
  }

  emit(value: T): void {
    if (this._isDisposed) {
      throw new Error('Event is disposed');
    }
    this._subscribable._emit(value);
  }

  dispose(): void {
    if (!this._isDisposed) {
      this._isDisposed = true;
      this._subscribable._dispose();
    }
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }
}

export class AggregateEvent<T = unknown> extends Event<T> {
  private _pipedSubscriptions: EventSubscription[] = [];

  pipe(...sources: EventSubscribable<T>[]): EventSubscription[] {
    const newSubs: EventSubscription[] = [];
    for (const source of sources) {
      const sub = source.subscribe((value: T) => {
        this.emit(value);
      });
      this._pipedSubscriptions.push(sub);
      newSubs.push(sub);
    }
    return newSubs;
  }

  override dispose(): void {
    for (const sub of this._pipedSubscriptions) {
      if (!sub.closed) {
        sub.dispose();
      }
    }
    this._pipedSubscriptions.length = 0;
    super.dispose();
  }
}

export function isEvent(value: unknown): value is Event {
  return value instanceof Event;
}

export function isEventSubscribable(value: unknown): value is EventSubscribable {
  return value instanceof EventSubscribable;
}

export function isAggregateEvent(value: unknown): value is AggregateEvent {
  return value instanceof AggregateEvent;
}
