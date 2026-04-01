import { Observable } from './observable.js';
import { Computed } from './computed.js';
import { isSubscribable } from './subscribable.js';
import type { Subscription } from './subscribable.js';
import { getObservable, replaceObservable } from './decorators.js';
import { addDisposeCallback } from './domNodeDisposal.js';

const SKIP_KEYS = new Set(['$raw']);

function getWritableChildTarget(instance: object, key: string): Observable<unknown> | Computed<unknown> | undefined {
  const decorated = getObservable(instance, key);
  if (decorated instanceof Observable) return decorated;
  if (decorated instanceof Computed && decorated.hasWriteFunction) return decorated;

  const directValue = (instance as Record<string, unknown>)[key];
  if (directValue instanceof Observable) return directValue;
  if (directValue instanceof Computed && directValue.hasWriteFunction) return directValue;

  return undefined;
}

export interface WireParamsResult {
  subscriptions: Subscription<unknown>[];
}

export function wireParams(
  instance: object,
  params: Record<string, unknown>,
  element?: Node,
): WireParamsResult {
  const subscriptions: Subscription<unknown>[] = [];

  for (const key of Object.keys(params)) {
    if (SKIP_KEYS.has(key)) continue;

    const paramValue = params[key];
    const childTarget = getWritableChildTarget(instance, key);
    const childIsReactive = childTarget !== undefined && isSubscribable(childTarget);

    if (paramValue instanceof Observable) {
      if (childIsReactive) {
        replaceObservable(instance, key, paramValue);
      } else {
        (instance as Record<string, unknown>)[key] = paramValue.get();
      }
    } else if (paramValue instanceof Computed) {
      if (childTarget) {
        childTarget.set(paramValue.get());
      } else {
        (instance as Record<string, unknown>)[key] = paramValue.get();
      }
      const sub = paramValue.subscribe((newValue: unknown) => {
        if (childTarget) {
          childTarget.set(newValue);
        } else {
          (instance as Record<string, unknown>)[key] = newValue;
        }
      });
      subscriptions.push(sub);
      if (element) {
        addDisposeCallback(element, () => sub.dispose());
      }
    } else {
      (instance as Record<string, unknown>)[key] = paramValue;
    }
  }

  return { subscriptions };
}
