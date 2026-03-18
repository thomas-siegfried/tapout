import { Subscribable, valuesArePrimitiveAndEqual } from './subscribable.js';
import { begin, end, registerDependency } from './dependencyDetection.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySubscribable = Subscribable<any>;

interface DependencyTracking {
  _target: AnySubscribable;
  _order: number;
  _version: number;
  dispose?(): void;
}

export interface ComputedOptions<T> {
  read: () => T;
  write?: (value: T) => void;
  pure?: boolean;
  deferEvaluation?: boolean;
}

export class Computed<T> extends Subscribable<T> {
  private _latestValue: T | undefined = undefined;
  private _readFunction: (() => T) | undefined;
  private _writeFunction: ((value: T) => void) | undefined;
  private _isDisposed = false;
  private _isBeingEvaluated = false;
  private _isDirty = true;
  private _pure: boolean;
  private _isSleeping: boolean;
  private _dependencyTracking: Record<number, DependencyTracking | null> = {};
  private _dependenciesCount = 0;
  private _deferEvaluation: boolean;

  constructor(evaluatorOrOptions: (() => T) | ComputedOptions<T>) {
    super();
    if (typeof evaluatorOrOptions === 'function') {
      this._readFunction = evaluatorOrOptions;
      this._pure = false;
      this._deferEvaluation = false;
    } else {
      this._readFunction = evaluatorOrOptions.read;
      this._writeFunction = evaluatorOrOptions.write;
      this._pure = evaluatorOrOptions.pure ?? false;
      this._deferEvaluation = evaluatorOrOptions.deferEvaluation ?? false;
    }

    this._isSleeping = this._pure;
    this.equalityComparer = valuesArePrimitiveAndEqual;

    if (!this._isSleeping && !this._deferEvaluation) {
      this.evaluateImmediate();
    }
  }

  get hasWriteFunction(): boolean {
    return typeof this._writeFunction === 'function';
  }

  get isPure(): boolean {
    return this._pure;
  }

  get(): T {
    if (!this._isDisposed) {
      registerDependency(this);
    }
    if (this._isDirty || (this._isSleeping && this.haveDependenciesChanged())) {
      this.evaluateImmediate();
    }
    return this._latestValue as T;
  }

  peek(): T {
    if (
      (this._isDirty && !this._dependenciesCount) ||
      (this._isSleeping && this.haveDependenciesChanged())
    ) {
      this.evaluateImmediate();
    }
    return this._latestValue as T;
  }

  set(value: T): void {
    if (!this._writeFunction) {
      throw new Error('Cannot write a value to a ko.computed unless you specify a \'write\' option.');
    }
    this._writeFunction(value);
  }

  getVersion(): number {
    if (this._isSleeping && (this._isDirty || this.haveDependenciesChanged())) {
      this.evaluateImmediate();
    }
    return super.getVersion();
  }

  dispose(): void {
    if (this._isDisposed) return;

    if (!this._isSleeping) {
      for (const id of Object.keys(this._dependencyTracking)) {
        const dep = this._dependencyTracking[Number(id)];
        if (dep?.dispose) {
          dep.dispose();
        }
      }
    }

    this._dependencyTracking = {};
    this._dependenciesCount = 0;
    this._isDisposed = true;
    this._isDirty = false;
    this._isSleeping = false;
    this._readFunction = undefined;
  }

  getDependenciesCount(): number {
    return this._dependenciesCount;
  }

  getDependencies(): AnySubscribable[] {
    const deps: AnySubscribable[] = [];
    for (const id of Object.keys(this._dependencyTracking)) {
      const tracking = this._dependencyTracking[Number(id)];
      if (tracking) {
        deps[tracking._order] = tracking._target;
      }
    }
    return deps;
  }

  isActive(): boolean {
    return this._isDirty || this._dependenciesCount > 0;
  }

  /** @internal */
  private _isStale = false;
  /** @internal */
  _evalDelayed?: (isChange: boolean) => void;

  override limit(limitFunction: (callback: () => void) => () => void): void {
    super.limit(limitFunction);

    this._evalIfChanged = () => {
      if (!this._isSleeping) {
        if (this._isStale) {
          this.evaluateImmediate();
        } else {
          this._isDirty = false;
        }
      }
      return this._latestValue as T;
    };

    this._evalDelayed = (isChange: boolean) => {
      this._limitBeforeChange!(this._latestValue as T);

      this._isDirty = true;
      if (isChange) {
        this._isStale = true;
      }

      this._limitChange!(this as unknown as T, !isChange);
    };
  }

  haveDependenciesChanged(): boolean {
    if (this._isBeingEvaluated) {
      return false;
    }
    this._isBeingEvaluated = true;
    try {
      for (const id of Object.keys(this._dependencyTracking)) {
        const dep = this._dependencyTracking[Number(id)];
        if (dep && dep._target.hasChanged(dep._version)) {
          return true;
        }
      }
      return false;
    } finally {
      this._isBeingEvaluated = false;
    }
  }

  protected override beforeSubscriptionAdd(event: string): void {
    if (this._deferEvaluation && (event === 'change' || event === 'beforeChange')) {
      this._deferEvaluation = false;
      this.peek();
    }

    if (!this._pure || this._isDisposed || !this._isSleeping || event !== 'change') {
      return;
    }
    this._wake();
  }

  protected override afterSubscriptionRemove(event: string): void {
    if (!this._pure || this._isDisposed || event !== 'change') {
      return;
    }
    if (!this.hasSubscriptionsForEvent('change')) {
      this._sleep();
    }
  }

  private _wake(): void {
    this._isSleeping = false;

    if (this._isDirty || this.haveDependenciesChanged()) {
      this._dependencyTracking = {};
      this._dependenciesCount = 0;
      if (this.evaluateImmediate()) {
        this.updateVersion();
      }
    } else {
      const dependenciesOrder: number[] = [];
      for (const id of Object.keys(this._dependencyTracking)) {
        const dep = this._dependencyTracking[Number(id)];
        if (dep) {
          dependenciesOrder[dep._order] = Number(id);
        }
      }

      for (let order = 0; order < dependenciesOrder.length; order++) {
        const id = dependenciesOrder[order];
        if (id === undefined) continue;
        const dep = this._dependencyTracking[id]!;
        const subscription = this._subscribeToDependency(dep._target);
        subscription._order = order;
        subscription._version = dep._version;
        this._dependencyTracking[id] = subscription;
      }

      if (this.haveDependenciesChanged()) {
        if (this.evaluateImmediate()) {
          this.updateVersion();
        }
      }
    }

    if (!this._isDisposed) {
      this.notifySubscribers(this._latestValue as T, 'awake');
    }
  }

  private _sleep(): void {
    for (const id of Object.keys(this._dependencyTracking)) {
      const dep = this._dependencyTracking[Number(id)];
      if (dep?.dispose) {
        this._dependencyTracking[Number(id)] = {
          _target: dep._target,
          _order: dep._order,
          _version: dep._version,
        };
        dep.dispose();
      }
    }
    this._isSleeping = true;
    this.notifySubscribers(undefined as T, 'asleep');
  }

  private evaluateImmediate(notifyChange = false): boolean {
    if (this._isBeingEvaluated || this._isDisposed) {
      return false;
    }

    this._isBeingEvaluated = true;
    try {
      return this._evaluateWithDependencyDetection(notifyChange);
    } finally {
      this._isBeingEvaluated = false;
    }
  }

  private _evaluateWithDependencyDetection(notifyChange: boolean): boolean {
    const isInitial = this._pure ? undefined : this._dependenciesCount === 0;

    const disposalCandidates = this._dependencyTracking;
    let disposalCount = this._dependenciesCount;

    this._dependencyTracking = {};
    this._dependenciesCount = 0;

    begin({
      callback: (subscribable: AnySubscribable, id: number) => {
        if (this._isDisposed) return;

        if (this._pure && subscribable === this) {
          throw new Error("A 'pure' computed must not be called recursively");
        }

        if (disposalCount && disposalCandidates[id]) {
          this._addDependencyTracking(id, subscribable, disposalCandidates[id]!);
          disposalCandidates[id] = null;
          --disposalCount;
        } else if (!this._dependencyTracking[id]) {
          const trackingObj = this._isSleeping
            ? { _target: subscribable, _order: 0, _version: 0 }
            : this._subscribeToDependency(subscribable);
          this._addDependencyTracking(id, subscribable, trackingObj);
        }
      },
      computed: this,
      isInitial: isInitial === undefined ? undefined : !!isInitial,
    });

    let newValue: T;
    try {
      newValue = this._readFunction!();
    } finally {
      end();

      if (disposalCount && !this._isSleeping) {
        for (const id of Object.keys(disposalCandidates)) {
          const entry = disposalCandidates[Number(id)];
          if (entry?.dispose) {
            entry.dispose();
          }
        }
      }

      this._isDirty = false;
    }

    let changed: boolean;
    if (!this._dependenciesCount) {
      this.dispose();
      changed = true;
    } else {
      changed = this.isDifferent(this._latestValue as T, newValue);
    }

    if (changed) {
      if (!this._isSleeping) {
        if (notifyChange) {
          this.notifySubscribers(this._latestValue as T, 'beforeChange');
        }
      } else {
        this.updateVersion();
      }

      this._latestValue = newValue;
      this.notifySubscribers(this._latestValue, 'spectate');

      if (!this._isSleeping && notifyChange) {
        this.notifySubscribers(this._latestValue);
      }
    }

    if (isInitial) {
      this.notifySubscribers(this._latestValue as T, 'awake');
    }

    return changed;
  }

  private _addDependencyTracking(
    id: number,
    target: AnySubscribable,
    trackingObj: DependencyTracking,
  ): void {
    this._dependencyTracking[id] = trackingObj;
    trackingObj._order = this._dependenciesCount++;
    trackingObj._version = target.getVersion();
  }

  private _subscribeToDependency(target: AnySubscribable): DependencyTracking {
    if (target._deferUpdates) {
      const dirtySub = target.subscribe(() => {
        if (this._evalDelayed && !this._isBeingEvaluated) {
          this._evalDelayed(false);
        }
      }, 'dirty');
      const changeSub = target.subscribe(() => {
        if (!this._notificationIsPending) {
          if (this._evalDelayed) {
            this._evalDelayed(true);
          } else {
            this.evaluateImmediate(true);
          }
        } else if (this._isDirty) {
          this._isStale = true;
        }
      });
      return {
        _target: target,
        _order: 0,
        _version: 0,
        dispose() {
          dirtySub.dispose();
          changeSub.dispose();
        },
      };
    }

    const subscription = target.subscribe(() => {
      if (this._evalDelayed) {
        this._evalDelayed(true);
      } else {
        this.evaluateImmediate(true);
      }
    });
    return {
      _target: target,
      _order: 0,
      _version: 0,
      dispose() {
        subscription.dispose();
      },
    };
  }
}

export class PureComputed<T> extends Computed<T> {
  constructor(evaluatorOrOptions: (() => T) | Omit<ComputedOptions<T>, 'pure'>) {
    if (typeof evaluatorOrOptions === 'function') {
      super({ read: evaluatorOrOptions, pure: true });
    } else {
      super({ ...evaluatorOrOptions, pure: true });
    }
  }
}

export function isComputed(value: unknown): value is Computed<unknown> {
  return value instanceof Computed;
}

export function isPureComputed(value: unknown): value is PureComputed<unknown> {
  return value instanceof Computed && (value as Computed<unknown>).isPure;
}
