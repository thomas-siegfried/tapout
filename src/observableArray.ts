import { Observable, isObservable } from './observable.js';
import { Subscription } from './subscribable.js';
import { compareArrays, findMovesInArrayComparison, type ArrayChange, type CompareArraysOptions } from './compareArrays.js';

const ARRAY_CHANGE_EVENT = 'arrayChange';

export class ObservableArray<T> extends Observable<T[]> {
  private _trackingChanges = false;
  private _cachedDiff: ArrayChange<T>[] | null = null;
  private _pendingChanges = 0;
  private _previousContents: T[] | undefined;
  private _changeSubscription: Subscription<T[]> | null = null;
  private _spectateSubscription: Subscription<T[]> | null = null;
  compareArrayOptions: CompareArraysOptions = { sparse: true };

  constructor(initialValues?: T[]) {
    super(initialValues ?? []);
  }

  // --- Array change tracking (lifecycle hooks) ---

  protected override beforeSubscriptionAdd(event: string): void {
    if (event === ARRAY_CHANGE_EVENT) {
      this._trackChanges();
    }
  }

  protected override afterSubscriptionRemove(event: string): void {
    if (event === ARRAY_CHANGE_EVENT && !this.hasSubscriptionsForEvent(ARRAY_CHANGE_EVENT)) {
      this._changeSubscription?.dispose();
      this._spectateSubscription?.dispose();
      this._changeSubscription = null;
      this._spectateSubscription = null;
      this._trackingChanges = false;
      this._previousContents = undefined;
    }
  }

  private _trackChanges(): void {
    if (this._trackingChanges) {
      this._notifyArrayChanges();
      return;
    }

    this._trackingChanges = true;

    this._spectateSubscription = this.subscribe(() => {
      ++this._pendingChanges;
    }, 'spectate');

    this._previousContents = ([] as T[]).concat(this.peek() || []);
    this._cachedDiff = null;

    this._changeSubscription = this.subscribe(() => this._notifyArrayChanges());
  }

  private _notifyArrayChanges(): void {
    if (this._pendingChanges) {
      const currentContents = ([] as T[]).concat(this.peek() || []);
      let changes: ArrayChange<T>[] | undefined;

      if (this.hasSubscriptionsForEvent(ARRAY_CHANGE_EVENT)) {
        changes = this._getChanges(this._previousContents!, currentContents);
      }

      this._previousContents = currentContents;
      this._cachedDiff = null;
      this._pendingChanges = 0;

      if (changes && changes.length) {
        this.notifySubscribers(changes as unknown as T[], ARRAY_CHANGE_EVENT);
      }
    }
  }

  private _getChanges(previousContents: T[], currentContents: T[]): ArrayChange<T>[] {
    if (!this._cachedDiff || this._pendingChanges > 1) {
      this._cachedDiff = compareArrays(previousContents, currentContents, this.compareArrayOptions);
    }
    return this._cachedDiff;
  }

  /** @internal */
  cacheDiffForKnownOperation(rawArray: T[], operationName: string, args: IArguments | T[]): void {
    if (!this._trackingChanges || this._pendingChanges) {
      return;
    }

    const diff: ArrayChange<T>[] = [];
    const arrayLength = rawArray.length;
    const argsLength = args.length;
    let offset = 0;

    function pushDiff(status: 'added' | 'deleted', value: T, index: number): ArrayChange<T> {
      const entry: ArrayChange<T> = { status, value, index };
      diff.push(entry);
      return entry;
    }

    switch (operationName) {
      case 'push':
        offset = arrayLength;
        // falls through
      case 'unshift':
        for (let index = 0; index < argsLength; index++) {
          pushDiff('added', args[index] as T, offset + index);
        }
        break;

      case 'pop':
        offset = arrayLength - 1;
        // falls through
      case 'shift':
        if (arrayLength) {
          pushDiff('deleted', rawArray[offset], offset);
        }
        break;

      case 'splice': {
        const startIndex = Math.min(Math.max(0, (args[0] as number) < 0 ? arrayLength + (args[0] as number) : (args[0] as number)), arrayLength);
        const endDeleteIndex = argsLength === 1 ? arrayLength : Math.min(startIndex + ((args[1] as number) || 0), arrayLength);
        const endAddIndex = startIndex + argsLength - 2;
        const endIndex = Math.max(endDeleteIndex, endAddIndex);
        const additions: ArrayChange<T>[] = [];
        const deletions: ArrayChange<T>[] = [];
        for (let index = startIndex, argsIndex = 2; index < endIndex; ++index, ++argsIndex) {
          if (index < endDeleteIndex)
            deletions.push(pushDiff('deleted', rawArray[index], index));
          if (index < endAddIndex)
            additions.push(pushDiff('added', args[argsIndex] as T, index));
        }
        findMovesInArrayComparison(deletions, additions);
        break;
      }

      default:
        return;
    }

    this._cachedDiff = diff;
  }

  // --- Standard array mutators ---

  push(...items: T[]): number {
    const underlyingArray = this.peek();
    this.valueWillMutate();
    this.cacheDiffForKnownOperation(underlyingArray, 'push', items);
    const result = underlyingArray.push(...items);
    this.valueHasMutated();
    return result;
  }

  pop(): T | undefined {
    const underlyingArray = this.peek();
    this.valueWillMutate();
    this.cacheDiffForKnownOperation(underlyingArray, 'pop', [] as T[]);
    const result = underlyingArray.pop();
    this.valueHasMutated();
    return result;
  }

  shift(): T | undefined {
    const underlyingArray = this.peek();
    this.valueWillMutate();
    this.cacheDiffForKnownOperation(underlyingArray, 'shift', [] as T[]);
    const result = underlyingArray.shift();
    this.valueHasMutated();
    return result;
  }

  unshift(...items: T[]): number {
    const underlyingArray = this.peek();
    this.valueWillMutate();
    this.cacheDiffForKnownOperation(underlyingArray, 'unshift', items);
    const result = underlyingArray.unshift(...items);
    this.valueHasMutated();
    return result;
  }

  splice(start: number, deleteCount?: number, ...items: T[]): T[] {
    const underlyingArray = this.peek();
    this.valueWillMutate();
    const spliceArgs: unknown[] = [start];
    if (deleteCount !== undefined) spliceArgs.push(deleteCount);
    spliceArgs.push(...items);
    this.cacheDiffForKnownOperation(underlyingArray, 'splice', spliceArgs as T[]);
    const result = underlyingArray.splice(start, deleteCount ?? underlyingArray.length, ...items);
    this.valueHasMutated();
    return result;
  }

  sort(compareFunction?: (a: T, b: T) => number): this {
    const underlyingArray = this.peek();
    this.valueWillMutate();
    underlyingArray.sort(compareFunction);
    this.valueHasMutated();
    return this;
  }

  reverse(): this {
    const underlyingArray = this.peek();
    this.valueWillMutate();
    underlyingArray.reverse();
    this.valueHasMutated();
    return this;
  }

  // --- Custom mutators ---

  remove(valueOrPredicate: T | ((item: T) => boolean)): T[] {
    const underlyingArray = this.peek();
    const removedValues: T[] = [];
    const predicate = typeof valueOrPredicate === 'function' && !isObservable(valueOrPredicate)
      ? valueOrPredicate as (item: T) => boolean
      : (value: T) => value === valueOrPredicate;

    for (let i = 0; i < underlyingArray.length; i++) {
      const value = underlyingArray[i];
      if (predicate(value)) {
        if (removedValues.length === 0) {
          this.valueWillMutate();
        }
        if (underlyingArray[i] !== value) {
          throw new Error('Array modified during remove; cannot remove item');
        }
        removedValues.push(value);
        underlyingArray.splice(i, 1);
        i--;
      }
    }

    if (removedValues.length) {
      this.valueHasMutated();
    }

    return removedValues;
  }

  removeAll(arrayOfValues?: T[]): T[] {
    if (arrayOfValues === undefined) {
      const underlyingArray = this.peek();
      const allValues = underlyingArray.slice(0);
      this.valueWillMutate();
      underlyingArray.splice(0, underlyingArray.length);
      this.valueHasMutated();
      return allValues;
    }

    if (!arrayOfValues) return [];

    return this.remove((value) => arrayOfValues.indexOf(value) >= 0);
  }

  // TODO: destroy/destroyAll may be removed in favor of a mapping library approach.
  destroy(valueOrPredicate: T | ((item: T) => boolean)): void {
    const underlyingArray = this.peek();
    const predicate = typeof valueOrPredicate === 'function' && !isObservable(valueOrPredicate)
      ? valueOrPredicate as (item: T) => boolean
      : (value: T) => value === valueOrPredicate;

    this.valueWillMutate();
    for (let i = underlyingArray.length - 1; i >= 0; i--) {
      const value = underlyingArray[i];
      if (predicate(value)) {
        (value as Record<symbol, boolean>)[DESTROY] = true;
      }
    }
    this.valueHasMutated();
  }

  destroyAll(arrayOfValues?: T[]): void {
    if (arrayOfValues === undefined) {
      this.destroy(() => true);
      return;
    }
    if (!arrayOfValues) return;
    this.destroy((value) => arrayOfValues.indexOf(value) >= 0);
  }

  replace(oldItem: T, newItem: T): void {
    const index = this.indexOf(oldItem);
    if (index >= 0) {
      this.valueWillMutate();
      this.peek()[index] = newItem;
      this.valueHasMutated();
    }
  }

  // --- Readers ---

  get length(): number {
    return this.get().length;
  }

  indexOf(item: T): number {
    return this.get().indexOf(item);
  }

  slice(start?: number, end?: number): T[] {
    return this.get().slice(start, end);
  }

  sorted(compareFunction?: (a: T, b: T) => number): T[] {
    const copy = this.get().slice(0);
    return compareFunction ? copy.sort(compareFunction) : copy.sort();
  }

  reversed(): T[] {
    return this.get().slice(0).reverse();
  }

  map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: unknown): U[] {
    return this.get().map(callbackfn, thisArg);
  }

  filter(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown): T[] {
    return this.get().filter(predicate as (value: T, index: number, array: T[]) => boolean, thisArg);
  }

  find(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown): T | undefined {
    return this.get().find(predicate as (value: T, index: number, array: T[]) => boolean, thisArg);
  }

  findIndex(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown): number {
    return this.get().findIndex(predicate as (value: T, index: number, array: T[]) => boolean, thisArg);
  }

  some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown): boolean {
    return this.get().some(predicate as (value: T, index: number, array: T[]) => boolean, thisArg);
  }

  every(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: unknown): boolean {
    return this.get().every(predicate as (value: T, index: number, array: T[]) => boolean, thisArg);
  }

  forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: unknown): void {
    this.get().forEach(callbackfn, thisArg);
  }

  reduce<U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U;
  reduce(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T;
  reduce<U>(callbackfn: (previousValue: U | T, currentValue: T, currentIndex: number, array: T[]) => U | T, ...args: unknown[]): U | T {
    const arr = this.get();
    if (args.length > 0) {
      return arr.reduce(callbackfn as (pv: U | T, cv: T, ci: number, a: T[]) => U | T, args[0] as U | T);
    }
    return arr.reduce(callbackfn as (pv: T, cv: T, ci: number, a: T[]) => T);
  }

  includes(searchElement: T, fromIndex?: number): boolean {
    return this.get().includes(searchElement, fromIndex);
  }

  at(index: number): T | undefined {
    return this.get().at(index);
  }

  join(separator?: string): string {
    return this.get().join(separator);
  }

  flat<D extends number = 1>(depth?: D): FlatArray<T[], D>[] {
    return this.get().flat(depth) as FlatArray<T[], D>[];
  }

  flatMap<U>(callback: (value: T, index: number, array: T[]) => U | readonly U[], thisArg?: unknown): U[] {
    return this.get().flatMap(callback, thisArg);
  }

  entries(): ArrayIterator<[number, T]> {
    return this.get().entries();
  }

  keys(): ArrayIterator<number> {
    return this.get().keys();
  }

  values(): ArrayIterator<T> {
    return this.get().values();
  }

  [Symbol.iterator](): ArrayIterator<T> {
    return this.get()[Symbol.iterator]();
  }
}

export function isObservableArray(value: unknown): value is ObservableArray<unknown> {
  return value instanceof ObservableArray;
}

// TODO: DESTROY/isDestroyed may be removed in favor of a mapping library approach.
export const DESTROY: unique symbol = Symbol('destroy');

export function isDestroyed(item: unknown): boolean {
  return item != null && (item as Record<symbol, unknown>)[DESTROY] === true;
}
