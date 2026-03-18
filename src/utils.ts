import { Observable } from './observable.js';
import { Computed, PureComputed } from './computed.js';
import type { Subscription } from './subscribable.js';

const MAX_NESTED_OBSERVABLE_DEPTH = 10;

function unwrapObservable(value: unknown): unknown {
  for (let i = 0; (value instanceof Observable || value instanceof Computed) && i < MAX_NESTED_OBSERVABLE_DEPTH; i++) {
    value = (value as Observable<unknown> | Computed<unknown>).peek();
  }
  return value;
}

function canHaveProperties(obj: unknown): obj is Record<string | number, unknown> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !(obj instanceof RegExp) &&
    !(obj instanceof Date) &&
    !(obj instanceof String) &&
    !(obj instanceof Number) &&
    !(obj instanceof Boolean)
  );
}

function mapJsObjectGraph(
  rootObject: unknown,
  visited: Map<object, unknown>,
): unknown {
  rootObject = unwrapObservable(rootObject);

  if (!canHaveProperties(rootObject)) {
    return rootObject;
  }

  const previouslyMapped = visited.get(rootObject);
  if (previouslyMapped !== undefined) {
    return previouslyMapped;
  }

  const isArray = Array.isArray(rootObject);
  const output: Record<string, unknown> | unknown[] = isArray ? [] as unknown[] : {};
  visited.set(rootObject, output);

  if (isArray) {
    const arr = rootObject as unknown as unknown[];
    const out = output as unknown[];
    for (let i = 0; i < arr.length; i++) {
      const propertyValue = unwrapObservable(arr[i]);
      out[i] = canHaveProperties(propertyValue)
        ? (visited.get(propertyValue as object) ?? mapJsObjectGraph(propertyValue, visited))
        : propertyValue;
    }
  } else {
    const out = output as Record<string, unknown>;
    for (const key in rootObject) {
      const propertyValue = unwrapObservable(rootObject[key]);
      out[key] = canHaveProperties(propertyValue)
        ? (visited.get(propertyValue as object) ?? mapJsObjectGraph(propertyValue, visited))
        : propertyValue;
    }
  }

  return output;
}

export function toJS<T>(rootObject: T): unknown {
  return mapJsObjectGraph(rootObject, new Map());
}

export function toJSON(
  rootObject: unknown,
  replacer?: (key: string, value: unknown) => unknown,
  space?: string | number,
): string {
  const plainObject = toJS(rootObject);
  return JSON.stringify(plainObject, replacer as Parameters<typeof JSON.stringify>[1], space);
}

export function when(
  predicate: () => unknown,
  callback?: (value: unknown) => void,
): Promise<unknown> | Subscription<unknown> {
  function kowhen(resolve: (value: unknown) => void): Subscription<unknown> {
    const observable = new PureComputed(predicate);
    observable.extend({ notify: 'always' });
    const subscription = observable.subscribe((value: unknown) => {
      if (value) {
        subscription.dispose();
        observable.dispose();
        resolve(value);
      }
    });
    observable.notifySubscribers(observable.peek());
    return subscription;
  }

  if (!callback) {
    return new Promise(kowhen);
  } else {
    return kowhen(callback);
  }
}
