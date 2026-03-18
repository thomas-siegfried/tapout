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

export { ObservableArray, isObservableArray, DESTROY, isDestroyed } from './observableArray.js';

export { compareArrays, findMovesInArrayComparison } from './compareArrays.js';
export type { ArrayChange, CompareArraysOptions } from './compareArrays.js';

export { Computed, PureComputed, isComputed, isPureComputed } from './computed.js';
export type { ComputedOptions } from './computed.js';

export { registerExtender, throttle, debounce } from './extenders.js';
export type { ExtenderHandler, RateLimitOptions } from './extenders.js';

export { toJS, toJSON, when } from './utils.js';

export { schedule, cancel, runEarly, resetForTesting } from './tasks.js';
import * as tasks from './tasks.js';
export { tasks };

export { domDataGet, domDataSet, domDataGetOrSet, domDataClear, domDataNextKey } from './domData.js';

export { addDisposeCallback, removeDisposeCallback, cleanNode, removeNode } from './domNodeDisposal.js';

export {
  isStartComment,
  hasBindingValue,
  virtualNodeBindingValue,
  virtualChildNodes,
  virtualFirstChild,
  virtualNextSibling,
  virtualEmptyNode,
  virtualSetChildren,
  virtualPrepend,
  virtualInsertAfter,
  allowedVirtualElementBindings,
} from './virtualElements.js';

export {
  parseObjectLiteral,
  preProcessBindings,
  twoWayBindings,
  writeValueToProperty,
  keyValueArrayContainsKey,
} from './expressionRewriting.js';
export type { KeyValuePair, PreProcessOptions, AllBindingsAccessor } from './expressionRewriting.js';

export {
  BindingContext,
  contextFor,
  dataFor,
  storedBindingContextForNode,
  SUBSCRIBABLE,
  ANCESTOR_BINDING_INFO,
  DATA_DEPENDENCY,
  BINDING_INFO_KEY,
} from './bindingContext.js';
export type { BindingContextOptions, CreateChildContextOptions, ExtendCallback } from './bindingContext.js';

import { Observable } from './observable.js';
import { Computed } from './computed.js';

export function isWritableObservable(value: unknown): value is Observable<unknown> | Computed<unknown> {
  if (value instanceof Observable) return true;
  if (value instanceof Computed) return value.hasWriteFunction;
  return false;
}
