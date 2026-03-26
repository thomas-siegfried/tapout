import { Observable } from './observable.js';
import { ObservableArray } from './observableArray.js';
import { Computed } from './computed.js';
import type { Subscribable } from './subscribable.js';
import type { ExtenderOptions } from './extenders.js';
import { registerDependency } from './dependencyDetection.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySubscribable = Subscribable<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccessorValue = ClassAccessorDecoratorTarget<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccessorContext = ClassAccessorDecoratorContext<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyAccessorResult = ClassAccessorDecoratorResult<any, any>;

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

// --- Detection helper ---

function isStage3Context(arg: unknown): arg is { kind: string; name: string | symbol } {
  return typeof arg === 'object' && arg !== null && 'kind' in arg;
}

// --- @reactive: Stage 3 accessor path ---

function createStage3Reactive(extenders?: ExtenderOptions) {
  return (_value: AnyAccessorValue, context: AnyAccessorContext): AnyAccessorResult => ({
    init(initialValue: unknown): unknown {
      const obs = new Observable(initialValue);
      if (extenders) obs.extend(extenders);
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

// --- @reactive: Legacy property decorator path ---

interface LegacyFieldDescriptor {
  configurable?: boolean;
  enumerable?: boolean;
  writable?: boolean;
  initializer?: (this: object) => unknown;
}

function applyLegacyReactive(
  target: object,
  propertyKey: string | symbol,
  descriptor?: LegacyFieldDescriptor,
  extenders?: ExtenderOptions,
): PropertyDescriptor {
  const initializer = descriptor?.initializer;
  const newDesc: PropertyDescriptor = {
    configurable: true,
    enumerable: true,
    get(this: object) {
      let obs = lookupObservable(this, propertyKey);
      if (!obs) {
        const initValue = initializer ? initializer.call(this) : undefined;
        obs = new Observable<unknown>(initValue);
        if (extenders) obs.extend(extenders);
        storeObservable(this, propertyKey, obs);
      }
      return (obs as Observable<unknown>).get();
    },
    set(this: object, value: unknown) {
      let obs = lookupObservable(this, propertyKey);
      if (!obs) {
        obs = new Observable<unknown>(value);
        if (extenders) obs.extend(extenders);
        storeObservable(this, propertyKey, obs);
      } else {
        (obs as Observable<unknown>).set(value);
      }
    },
  };
  if (!descriptor || typeof descriptor.initializer === 'undefined') {
    Object.defineProperty(target, propertyKey, newDesc);
  }
  return newDesc;
}

// --- @reactive: Unified decorator ---

/**
 * A decorator function returned by reactive(options) / reactiveArray(options).
 * Works as either a Stage 3 accessor decorator or a legacy property decorator.
 */
export interface ReactivePropertyDecorator {
  <This, Value>(value: ClassAccessorDecoratorTarget<This, Value>, context: ClassAccessorDecoratorContext<This, Value>): ClassAccessorDecoratorResult<This, Value>;
  (target: object, propertyKey: string | symbol): void;
}

export function reactive<This, Value>(value: ClassAccessorDecoratorTarget<This, Value>, context: ClassAccessorDecoratorContext<This, Value>): ClassAccessorDecoratorResult<This, Value>;
export function reactive(target: object, propertyKey: string | symbol): void;
export function reactive(target: object, propertyKey: string | symbol, descriptor: LegacyFieldDescriptor): PropertyDescriptor;
export function reactive(options: ExtenderOptions): ReactivePropertyDecorator;
export function reactive(
  valueOrOptions: unknown,
  contextOrKey?: unknown,
  descriptor?: LegacyFieldDescriptor,
): unknown {
  if (contextOrKey === undefined) {
    const ext = valueOrOptions as ExtenderOptions;
    return function (target: unknown, contextOrKey2: unknown, descriptor2?: LegacyFieldDescriptor) {
      if (isStage3Context(contextOrKey2)) {
        return createStage3Reactive(ext)(target as AnyAccessorValue, contextOrKey2 as AnyAccessorContext);
      }
      return applyLegacyReactive(target as object, contextOrKey2 as string | symbol, descriptor2, ext);
    };
  }
  if (isStage3Context(contextOrKey)) {
    return createStage3Reactive()(valueOrOptions as AnyAccessorValue, contextOrKey as AnyAccessorContext);
  }
  return applyLegacyReactive(valueOrOptions as object, contextOrKey as string | symbol, descriptor);
}

// --- @reactiveArray: Stage 3 accessor path ---

function createStage3ReactiveArray(extenders?: ExtenderOptions) {
  return (_value: AnyAccessorValue, context: AnyAccessorContext): AnyAccessorResult => ({
    init(initialValue: unknown): unknown {
      const arr = Array.isArray(initialValue) ? initialValue : [];
      const obs = new ObservableArray(arr);
      if (extenders) obs.extend(extenders);
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

// --- @reactiveArray: Legacy property decorator path ---

function applyLegacyReactiveArray(
  target: object,
  propertyKey: string | symbol,
  descriptor?: LegacyFieldDescriptor,
  extenders?: ExtenderOptions,
): PropertyDescriptor {
  const initializer = descriptor?.initializer;
  const newDesc: PropertyDescriptor = {
    configurable: true,
    enumerable: true,
    get(this: object) {
      let obs = lookupObservable(this, propertyKey);
      if (!obs) {
        const initValue = initializer ? initializer.call(this) : undefined;
        const arr = Array.isArray(initValue) ? initValue : [];
        obs = new ObservableArray<unknown>(arr);
        if (extenders) obs.extend(extenders);
        storeObservable(this, propertyKey, obs);
      }
      registerDependency(obs);
      return obs;
    },
    set(this: object, value: unknown) {
      let obs = lookupObservable(this, propertyKey);
      if (!obs) {
        const arr = Array.isArray(value) ? value : [];
        obs = new ObservableArray<unknown>(arr);
        if (extenders) obs.extend(extenders);
        storeObservable(this, propertyKey, obs);
      } else {
        (obs as ObservableArray<unknown>).set(value as unknown[]);
      }
    },
  };
  if (!descriptor || typeof descriptor.initializer === 'undefined') {
    Object.defineProperty(target, propertyKey, newDesc);
  }
  return newDesc;
}

// --- @reactiveArray: Unified decorator ---

export function reactiveArray<This, Value>(value: ClassAccessorDecoratorTarget<This, Value>, context: ClassAccessorDecoratorContext<This, Value>): ClassAccessorDecoratorResult<This, Value>;
export function reactiveArray(target: object, propertyKey: string | symbol): void;
export function reactiveArray(target: object, propertyKey: string | symbol, descriptor: LegacyFieldDescriptor): PropertyDescriptor;
export function reactiveArray(options: ExtenderOptions): ReactivePropertyDecorator;
export function reactiveArray(
  valueOrOptions: unknown,
  contextOrKey?: unknown,
  descriptor?: LegacyFieldDescriptor,
): unknown {
  if (contextOrKey === undefined) {
    const ext = valueOrOptions as ExtenderOptions;
    return function (target: unknown, contextOrKey2: unknown, descriptor2?: LegacyFieldDescriptor) {
      if (isStage3Context(contextOrKey2)) {
        return createStage3ReactiveArray(ext)(target as AnyAccessorValue, contextOrKey2 as AnyAccessorContext);
      }
      return applyLegacyReactiveArray(target as object, contextOrKey2 as string | symbol, descriptor2, ext);
    };
  }
  if (isStage3Context(contextOrKey)) {
    return createStage3ReactiveArray()(valueOrOptions as AnyAccessorValue, contextOrKey as AnyAccessorContext);
  }
  return applyLegacyReactiveArray(valueOrOptions as object, contextOrKey as string | symbol, descriptor);
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

// Stage 3 @computed implementation
function applyStage3Computed(
  value: AnyFunction,
  context: { kind: string; name: string | symbol },
): AnyFunction | void {
  const { kind, name } = context;

  if (kind === 'getter') {
    const originalGetter = value;
    return function (this: object) {
      const comp = getOrCreateComputed(this, name, originalGetter.bind(this));
      return comp.get();
    };
  }

  if (kind === 'setter') {
    const originalSetter = value;
    return function (this: object, newValue: unknown): void {
      const map = computedStorage.get(this);
      const comp = map?.get(name) as Computed<unknown> | undefined;
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
      const comp = getOrCreateComputed(this, name, originalMethod.bind(this));
      return comp.get();
    };
  }
}

// Legacy @computed implementation (method / getter+setter decorator)
function applyLegacyComputed(
  _target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor {
  if (descriptor.get) {
    const originalGetter = descriptor.get;
    const originalSetter = descriptor.set;

    descriptor.get = function (this: object) {
      const comp = getOrCreateComputed(
        this, propertyKey,
        originalGetter.bind(this),
        originalSetter ? originalSetter.bind(this) : undefined,
      );
      return comp.get();
    };

    if (originalSetter) {
      descriptor.set = function (this: object, value: unknown): void {
        const map = computedStorage.get(this);
        const comp = map?.get(propertyKey) as Computed<unknown> | undefined;
        if (comp) {
          comp.set(value);
        } else {
          originalSetter.call(this, value);
        }
      };
    }

    return descriptor;
  }

  if (typeof descriptor.value === 'function') {
    const originalMethod = descriptor.value as AnyFunction;
    descriptor.value = function (this: object): unknown {
      const comp = getOrCreateComputed(this, propertyKey, originalMethod.bind(this));
      return comp.get();
    };
    return descriptor;
  }

  return descriptor;
}

// --- @computed: Unified decorator ---

/**
 * A decorator function returned by or used as @computed.
 * Works as either a Stage 3 getter/setter/method decorator or a legacy method decorator.
 */
export interface ComputedMethodDecorator {
  <This, Value>(value: AnyFunction, context: ClassGetterDecoratorContext<This, Value> | ClassMethodDecoratorContext<This, AnyFunction> | ClassSetterDecoratorContext<This, Value>): AnyFunction | void;
  (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor | void;
}

// Stage 3 overloads
export function computed<This, Value>(
  value: AnyFunction,
  context: ClassGetterDecoratorContext<This, Value> | ClassMethodDecoratorContext<This, AnyFunction> | ClassSetterDecoratorContext<This, Value>,
): AnyFunction | void;
// Legacy overload
export function computed(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): PropertyDescriptor | void;
// Implementation
export function computed(
  valueOrTarget: unknown,
  contextOrKey?: unknown,
  descriptor?: PropertyDescriptor,
): unknown {
  if (isStage3Context(contextOrKey)) {
    return applyStage3Computed(
      valueOrTarget as AnyFunction,
      contextOrKey as { kind: string; name: string | symbol },
    );
  }
  return applyLegacyComputed(
    valueOrTarget as object,
    contextOrKey as string | symbol,
    descriptor!,
  );
}

// --- getObservable() / replaceObservable() ---

export function getObservable(target: object, key: string | symbol): AnySubscribable | undefined {
  let obs = lookupObservable(target, key);
  if (!obs) {
    void (target as Record<string | symbol, unknown>)[key];
    obs = lookupObservable(target, key);
  }
  return obs;
}

export function replaceObservable(instance: object, key: string | symbol, obs: AnySubscribable): void {
  storeObservable(instance, key, obs);
}
