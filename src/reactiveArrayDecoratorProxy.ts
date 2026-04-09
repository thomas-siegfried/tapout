import { registerDependency } from './dependencyDetection.js';
import { ObservableArray } from './observableArray.js';

const proxyCache = new WeakMap<ObservableArray<unknown>, object>();

/**
 * ES array index property name: ToString(ToUint32(P)) === P and ToUint32(P) ≠ 2³²−1.
 * @see https://tc39.es/ecma262/#sec-array-exotic-objects
 */
function parseArrayIndexString(key: string): number | undefined {
  const index = Number(key) >>> 0;
  if (index === 0xffff_ffff) return undefined;
  if (`${index}` !== key) return undefined;
  return index;
}

/**
 * Proxy used only for `@reactiveArray` decorated properties: supports `list[0]` read/write
 * while keeping `getObservable()` on the underlying {@link ObservableArray}.
 *
 * Methods and accessors are applied to the real instance (not the proxy) so internal state works.
 */
export function getReactiveArrayDecoratorProxy<T>(obs: ObservableArray<T>): ObservableArray<T> {
  let prox = proxyCache.get(obs as ObservableArray<unknown>);
  if (!prox) {
    prox = new Proxy(obs, {
      get(target, prop, _receiver) {
        if (typeof prop === 'string') {
          const index = parseArrayIndexString(prop);
          if (index !== undefined) {
            registerDependency(target);
            return target.peek()[index];
          }
        }
        const value = Reflect.get(target, prop, target);
        if (typeof value === 'function') {
          return value.bind(target);
        }
        return value;
      },
      set(target, prop, value, _receiver) {
        if (typeof prop === 'string') {
          const index = parseArrayIndexString(prop);
          if (index !== undefined) {
            const arr = target.peek();
            target.valueWillMutate();
            arr[index] = value as T;
            target.valueHasMutated();
            return true;
          }
        }
        return Reflect.set(target, prop, value, target);
      },
      has(target, prop) {
        if (typeof prop === 'string') {
          const index = parseArrayIndexString(prop);
          if (index !== undefined) {
            registerDependency(target);
            return Reflect.has(target.peek(), prop);
          }
        }
        return Reflect.has(target, prop);
      },
      deleteProperty(target, prop) {
        if (typeof prop === 'string') {
          const index = parseArrayIndexString(prop);
          if (index !== undefined) {
            const arr = target.peek();
            if (Reflect.has(arr, prop)) {
              target.valueWillMutate();
              delete arr[index];
              target.valueHasMutated();
              return true;
            }
            return true;
          }
        }
        return Reflect.deleteProperty(target, prop);
      },
    });
    proxyCache.set(obs as ObservableArray<unknown>, prox);
  }
  return prox as ObservableArray<T>;
}
