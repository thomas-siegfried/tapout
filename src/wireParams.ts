import { Observable } from './observable.js';
import { Computed } from './computed.js';
import { isSubscribable } from './subscribable.js';
import type { Subscription } from './subscribable.js';
import { getObservable, replaceObservable } from './decorators.js';
import { addDisposeCallback } from './domNodeDisposal.js';

const SKIP_KEYS = new Set(['$raw']);

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
    const childObs = getObservable(instance, key);
    const childIsReactive = childObs !== undefined && isSubscribable(childObs);

    if (paramValue instanceof Observable) {
      if (childIsReactive) {
        replaceObservable(instance, key, paramValue);
      } else {
        (instance as Record<string, unknown>)[key] = paramValue.get();
      }
    } else if (paramValue instanceof Computed) {
      (instance as Record<string, unknown>)[key] = paramValue.get();
      const sub = paramValue.subscribe((newValue: unknown) => {
        (instance as Record<string, unknown>)[key] = newValue;
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
