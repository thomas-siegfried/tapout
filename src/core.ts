export { options } from './options.js';

export const version = '1.0.0';

export { Subscribable, Subscription, isSubscribable, isReadableSubscribable, valuesArePrimitiveAndEqual } from './subscribable.js';
export type { SubscriptionCallback, ReadableSubscribable } from './subscribable.js';

export {
  begin,
  end,
  registerDependency,
  ignore,
  getDependenciesCount,
  getDependencies,
  isInitial,
  getCurrentComputed,
} from './dependencyDetection.js';
export type { TrackingFrame } from './dependencyDetection.js';

export { Observable, isObservable } from './observable.js';

export { ObservableArray, isObservableArray, DESTROY, isDestroyed } from './observableArray.js';

export { compareArrays, findMovesInArrayComparison } from './compareArrays.js';
export type { ArrayChange, CompareArraysOptions } from './compareArrays.js';

export { Computed, PureComputed, isComputed, isPureComputed } from './computed.js';
export type { ComputedOptions } from './computed.js';

export { registerExtender, throttle, debounce } from './extenders.js';
export type { ExtenderHandler, ExtenderMap, ExtenderOptions, RateLimitOptions } from './extenders.js';

export { effect, observe } from './effects.js';
export type { EffectHandle } from './effects.js';

export { Event, EventSubscribable, EventSubscription, AggregateEvent, isEvent, isEventSubscribable, isAggregateEvent } from './event.js';
export type { EventCallback, Constructor } from './event.js';

export { DisposableGroup } from './disposable.js';
export type { Disposable } from './disposable.js';

export { reactive, reactiveArray, computed, getObservable, replaceObservable } from './decorators.js';

export {
  unwrapObservable, peekObservable, toJS, toJSON, when,
  catchFunctionErrors,
} from './utils.js';

export { schedule, cancel, runEarly, resetForTesting } from './tasks.js';
import * as tasks from './tasks.js';
export { tasks };

import { Observable } from './observable.js';
import { Computed } from './computed.js';

export function isWritableObservable(value: unknown): value is Observable<unknown> | Computed<unknown> {
  if (value instanceof Observable) return true;
  if (value instanceof Computed) return value.hasWriteFunction;
  return false;
}
