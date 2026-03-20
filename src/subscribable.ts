import { begin, end } from './dependencyDetection.js';
import { getExtenderHandler } from './extenders.js';

export type SubscriptionCallback<T> = (value: T) => void;

const primitiveTypes: Record<string, boolean> = {
  undefined: true,
  boolean: true,
  number: true,
  string: true,
};

export function valuesArePrimitiveAndEqual<T>(a: T, b: T): boolean {
  const oldValueIsPrimitive = a === null || typeof a in primitiveTypes;
  return oldValueIsPrimitive ? a === b : false;
}

const DEFAULT_EVENT = 'change';

export class Subscription<T> {
  private _target: Subscribable<T> | null;
  private _callback: SubscriptionCallback<T> | null;
  private _disposeCallback: (() => void) | null;
  private _isDisposed = false;

  constructor(
    target: Subscribable<T>,
    callback: SubscriptionCallback<T>,
    disposeCallback: () => void,
  ) {
    this._target = target;
    this._callback = callback;
    this._disposeCallback = disposeCallback;
  }

  dispose(): void {
    if (!this._isDisposed) {
      this._isDisposed = true;
      this._disposeCallback!();
      this._target = null;
      this._callback = null;
      this._disposeCallback = null;
    }
  }

  get closed(): boolean {
    return this._isDisposed;
  }

  /** @internal */
  _notify(value: T): void {
    if (!this._isDisposed) {
      this._callback!(value);
    }
  }
}

export class Subscribable<T = unknown> {
  private _subscriptions: Record<string, Subscription<T>[]> = { [DEFAULT_EVENT]: [] };
  private _versionNumber = 1;

  /** @internal Lazy unique ID for dependency tracking */
  _id: number | undefined;

  equalityComparer?: (a: T, b: T) => boolean;

  protected beforeSubscriptionAdd?(event: string): void;
  protected afterSubscriptionRemove?(event: string): void;

  subscribe(callback: SubscriptionCallback<T>, event?: string): Subscription<T> {
    const eventName = event ?? DEFAULT_EVENT;

    const subscription = new Subscription<T>(this, callback, () => {
      const subs = this._subscriptions[eventName];
      if (subs) {
        const index = subs.indexOf(subscription);
        if (index !== -1) {
          subs.splice(index, 1);
        }
      }
      this.afterSubscriptionRemove?.(eventName);
    });

    this.beforeSubscriptionAdd?.(eventName);

    if (!this._subscriptions[eventName]) {
      this._subscriptions[eventName] = [];
    }
    this._subscriptions[eventName].push(subscription);

    return subscription;
  }

  notifySubscribers(value: T, event?: string): void {
    const eventName = event ?? DEFAULT_EVENT;

    if (eventName === DEFAULT_EVENT) {
      this.updateVersion();
    }

    if (this.hasSubscriptionsForEvent(eventName)) {
      const subs = this._subscriptions[eventName].slice(0);
      try {
        begin();
        for (let i = 0; i < subs.length; i++) {
          subs[i]._notify(value);
        }
      } finally {
        end();
      }
    }
  }

  getVersion(): number {
    return this._versionNumber;
  }

  hasChanged(versionToCheck: number): boolean {
    return this._versionNumber !== versionToCheck;
  }

  updateVersion(): void {
    ++this._versionNumber;
  }

  hasSubscriptionsForEvent(event: string): boolean {
    const subs = this._subscriptions[event];
    return subs != null && subs.length > 0;
  }

  getSubscriptionsCount(event?: string): number {
    if (event) {
      const subs = this._subscriptions[event];
      return subs ? subs.length : 0;
    }
    let total = 0;
    for (const key of Object.keys(this._subscriptions)) {
      if (key !== 'dirty') {
        total += this._subscriptions[key].length;
      }
    }
    return total;
  }

  isDifferent(oldValue: T, newValue: T): boolean {
    if (this.equalityComparer) {
      return !this.equalityComparer(oldValue, newValue);
    }
    return true;
  }

  extend(requestedExtenders: Record<string, unknown>): this {
    for (const [key, value] of Object.entries(requestedExtenders)) {
      const handler = getExtenderHandler(key);
      if (typeof handler === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler(this as Subscribable<any>, value);
      }
    }
    return this;
  }

  /** @internal */
  _deferUpdates = false;
  /** @internal */
  _origNotifySubscribers?: (value: T, event?: string) => void;
  /** @internal */
  _limitChange?: (value: T, isDirty?: boolean) => void;
  /** @internal */
  _limitBeforeChange?: (value: T) => void;
  /** @internal */
  _recordUpdate?: () => void;
  /** @internal */
  _notificationIsPending?: boolean;
  /** @internal */
  _changeSubscriptions?: Subscription<T>[];
  /** @internal */
  _evalIfChanged?(): T;

  limit(limitFunction: (callback: () => void) => () => void): void {
    const self = this;
    let ignoreBeforeChange = false;
    let previousValue: T;
    let pendingValue: T;
    let didUpdate = false;

    if (!self._origNotifySubscribers) {
      self._origNotifySubscribers = self.notifySubscribers.bind(self);
      self.notifySubscribers = function limitNotifySubscribers(value: T, event?: string): void {
        if (!event || event === DEFAULT_EVENT) {
          self._limitChange!(value);
        } else if (event === 'beforeChange') {
          self._limitBeforeChange!(value);
        } else {
          self._origNotifySubscribers!(value, event);
        }
      };
    }

    const finish = limitFunction(function () {
      self._notificationIsPending = false;

      if (pendingValue === (self as unknown) && self._evalIfChanged) {
        pendingValue = self._evalIfChanged();
      }
      const shouldNotify = didUpdate && self.isDifferent(previousValue, pendingValue);

      didUpdate = ignoreBeforeChange = false;

      if (shouldNotify) {
        previousValue = pendingValue;
        self._origNotifySubscribers!(pendingValue);
      }
    });

    self._limitChange = function (value: T, isDirty?: boolean) {
      if (!isDirty || !self._notificationIsPending) {
        didUpdate = !isDirty;
      }
      self._changeSubscriptions = self._subscriptions[DEFAULT_EVENT].slice(0);
      self._notificationIsPending = ignoreBeforeChange = true;
      pendingValue = value;
      finish();
    };

    self._limitBeforeChange = function (value: T) {
      if (!ignoreBeforeChange) {
        previousValue = value;
        self._origNotifySubscribers!(value, 'beforeChange');
      }
    };

    self._recordUpdate = function () {
      didUpdate = true;
    };
  }
}

export function isSubscribable(value: unknown): value is Subscribable {
  return (
    value != null &&
    typeof (value as Subscribable).subscribe === 'function' &&
    typeof (value as Subscribable).notifySubscribers === 'function'
  );
}

export interface ReadableSubscribable<T = unknown> extends Subscribable<T> {
  get(): T;
  peek(): T;
}

export function isReadableSubscribable(value: unknown): value is ReadableSubscribable {
  return (
    isSubscribable(value) &&
    typeof (value as ReadableSubscribable).get === 'function' &&
    typeof (value as ReadableSubscribable).peek === 'function'
  );
}
