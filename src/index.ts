export { Subscribable, Subscription, isSubscribable, valuesArePrimitiveAndEqual } from './subscribable.js';
export type { SubscriptionCallback } from './subscribable.js';

export {
  begin,
  end,
  registerDependency,
  ignore,
  getDependenciesCount,
  getDependencies,
  isInitial,
} from './dependencyDetection.js';
export type { TrackingFrame } from './dependencyDetection.js';

export { Observable, isObservable } from './observable.js';

export { Computed, PureComputed, isComputed, isPureComputed } from './computed.js';
export type { ComputedOptions } from './computed.js';

import { Observable } from './observable.js';
import { Computed } from './computed.js';

export function isWritableObservable(value: unknown): value is Observable<unknown> | Computed<unknown> {
  if (value instanceof Observable) return true;
  if (value instanceof Computed) return value.hasWriteFunction;
  return false;
}
