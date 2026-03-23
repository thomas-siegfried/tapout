import { Observable } from './observable.js';
import { ObservableArray } from './observableArray.js';
import { Computed } from './computed.js';
import type { Subscribable } from './subscribable.js';
import { registerDependency } from './dependencyDetection.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySubscribable = Subscribable<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccessorValue = ClassAccessorDecoratorTarget<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccessorContext = ClassAccessorDecoratorContext<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccessorResult = ClassAccessorDecoratorResult<any, any>;

type ExtenderOptions = Record<string, unknown>;

// --- Observable registry for getObservable() ---

const accessorRegistry = new Map<string | symbol, WeakMap<object, AnySubscribable>>();
const computedStorage = new WeakMap<object, Map<string | symbol, Computed<unknown>>>();

function storeObservable(instance: object, key: string | symbol, obs: AnySubscribable): void {
  let instanceMap = accessorRegistry.get(key);
  if (!instanceMap) {
    instanceMap = new WeakMap();
    accessorRegistry.set(key, instanceMap);
  }
  instanceMap.set(instance, obs);
}

function lookupObservable(instance: object, key: string | symbol): AnySubscribable | undefined {
  const instanceMap = accessorRegistry.get(key);
  if (instanceMap) {
    return instanceMap.get(instance);
  }
  const compMap = computedStorage.get(instance);
  if (compMap) {
    return compMap.get(key);
  }
  return undefined;
}

// --- @reactive ---

type AccessorDecorator = (value: AnyAccessorValue, context: AnyAccessorContext) => AnyAccessorResult;

function createReactiveDecorator(extenders?: ExtenderOptions): AccessorDecorator {
  return (_value: AnyAccessorValue, context: AnyAccessorContext): AnyAccessorResult => ({
    init(initialValue: unknown): unknown {
      const obs = new Observable(initialValue);
      if (extenders) {
        obs.extend(extenders);
      }
      storeObservable(this as object, context.name, obs);
      return obs;
    },
    get(this: object): unknown {
      const obs = lookupObservable(this, context.name) as Observable<unknown>;
      return obs.get();
    },
    set(this: object, newValue: unknown): void {
      const obs = lookupObservable(this, context.name) as Observable<unknown>;
      obs.set(newValue);
    },
  });
}

export function reactive(options: ExtenderOptions): AccessorDecorator;
export function reactive(value: AnyAccessorValue, context: AnyAccessorContext): AnyAccessorResult;
export function reactive(
  valueOrOptions: AnyAccessorValue | ExtenderOptions,
  context?: AnyAccessorContext,
): AnyAccessorResult | AccessorDecorator {
  if (context !== undefined) {
    return createReactiveDecorator()(valueOrOptions as AnyAccessorValue, context);
  }
  return createReactiveDecorator(valueOrOptions as ExtenderOptions);
}

// --- @reactiveArray ---

function createReactiveArrayDecorator(extenders?: ExtenderOptions): AccessorDecorator {
  return (_value: AnyAccessorValue, context: AnyAccessorContext): AnyAccessorResult => ({
    init(initialValue: unknown): unknown {
      const arr = Array.isArray(initialValue) ? initialValue : [];
      const obs = new ObservableArray(arr);
      if (extenders) {
        obs.extend(extenders);
      }
      storeObservable(this as object, context.name, obs);
      return obs;
    },
    get(this: object): unknown {
      const obs = lookupObservable(this, context.name) as ObservableArray<unknown>;
      registerDependency(obs);
      return obs;
    },
    set(this: object, newValue: unknown): void {
      const obs = lookupObservable(this, context.name) as ObservableArray<unknown>;
      obs.set(newValue as unknown[]);
    },
  });
}

export function reactiveArray(options: ExtenderOptions): AccessorDecorator;
export function reactiveArray(value: AnyAccessorValue, context: AnyAccessorContext): AnyAccessorResult;
export function reactiveArray(
  valueOrOptions: AnyAccessorValue | ExtenderOptions,
  context?: AnyAccessorContext,
): AnyAccessorResult | AccessorDecorator {
  if (context !== undefined) {
    return createReactiveArrayDecorator()(valueOrOptions as AnyAccessorValue, context);
  }
  return createReactiveArrayDecorator(valueOrOptions as ExtenderOptions);
}

// --- @computed ---

function getOrCreateComputed<T>(
  instance: object,
  key: string | symbol,
  readFn: () => T,
  writeFn?: (value: T) => void,
): Computed<T> {
  let map = computedStorage.get(instance);
  if (!map) {
    map = new Map();
    computedStorage.set(instance, map);
  }
  let comp = map.get(key) as Computed<T> | undefined;
  if (!comp) {
    comp = new Computed<T>({
      read: readFn,
      write: writeFn,
      deferEvaluation: true,
    });
    map.set(key, comp as Computed<unknown>);
  }
  return comp;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

export function computed<This, Value>(
  value: AnyFunction,
  context: ClassGetterDecoratorContext<This, Value> | ClassMethodDecoratorContext<This, AnyFunction> | ClassSetterDecoratorContext<This, Value>,
): AnyFunction | void {
  const { kind, name } = context;

  if (kind === 'getter') {
    const originalGetter = value;
    return function (this: object): Value {
      const comp = getOrCreateComputed<Value>(
        this, name,
        originalGetter.bind(this) as () => Value,
      );
      return comp.get();
    };
  }

  if (kind === 'setter') {
    const originalSetter = value;
    return function (this: object, newValue: Value): void {
      const map = computedStorage.get(this);
      const comp = map?.get(name) as Computed<Value> | undefined;
      if (comp) {
        comp.set(newValue);
      } else {
        originalSetter.call(this, newValue);
      }
    };
  }

  if (kind === 'method') {
    const originalMethod = value;
    return function (this: object): unknown {
      const comp = getOrCreateComputed(
        this, name,
        originalMethod.bind(this),
      );
      return comp.get();
    };
  }
}

// --- getObservable() / replaceObservable() ---

export function getObservable(target: object, key: string | symbol): AnySubscribable | undefined {
  return lookupObservable(target, key);
}

export function replaceObservable(instance: object, key: string | symbol, obs: AnySubscribable): void {
  storeObservable(instance, key, obs);
}
