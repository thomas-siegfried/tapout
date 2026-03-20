import { Subscribable, valuesArePrimitiveAndEqual } from './subscribable.js';
import type { ReadableSubscribable } from './subscribable.js';
import { registerDependency } from './dependencyDetection.js';
import { options } from './options.js';

export class Observable<T> extends Subscribable<T> implements ReadableSubscribable<T> {
  private _latestValue: T;

  constructor(initialValue: T) {
    super();
    this._latestValue = initialValue;
    this.equalityComparer = valuesArePrimitiveAndEqual;

    if (options.deferUpdates) {
      this.extend({ deferred: true });
    }
  }

  get(): T {
    registerDependency(this);
    return this._latestValue;
  }

  set(value: T): void {
    if (this.isDifferent(this._latestValue, value)) {
      this.valueWillMutate();
      this._latestValue = value;
      this.valueHasMutated();
    }
  }

  peek(): T {
    return this._latestValue;
  }

  valueHasMutated(): void {
    this.notifySubscribers(this._latestValue, 'spectate');
    this.notifySubscribers(this._latestValue);
  }

  valueWillMutate(): void {
    this.notifySubscribers(this._latestValue, 'beforeChange');
  }
}

export function isObservable(value: unknown): value is Observable<unknown> {
  return value instanceof Observable;
}
