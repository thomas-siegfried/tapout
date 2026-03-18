import {
  Subscribable,
  Subscription,
  isSubscribable,
  valuesArePrimitiveAndEqual,
  begin,
  end,
  registerDependency,
  ignore,
  getDependenciesCount,
  getDependencies,
  isInitial,
  Observable,
  isObservable,
  isWritableObservable,
  ObservableArray,
  isObservableArray,
  DESTROY,
  isDestroyed,
  compareArrays,
  findMovesInArrayComparison,
  Computed,
  PureComputed,
  isComputed,
  isPureComputed,
  registerExtender,
  throttle,
  debounce,
  toJS,
  toJSON,
  when,
  domDataGet,
  domDataSet,
  domDataGetOrSet,
  domDataClear,
  domDataNextKey,
  addDisposeCallback,
  removeDisposeCallback,
  cleanNode,
  removeNode,
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
  parseObjectLiteral,
  preProcessBindings,
  twoWayBindings,
  writeValueToProperty,
  keyValueArrayContainsKey,
  schedule,
  cancel,
  runEarly,
  resetForTesting,
  tasks,
  BindingContext,
  contextFor,
  dataFor,
  storedBindingContextForNode,
  SUBSCRIBABLE,
  ANCESTOR_BINDING_INFO,
  DATA_DEPENDENCY,
  BINDING_INFO_KEY,
  BindingProvider,
  bindingHandlers,
  getBindingHandler,
  bindingProviderInstance,
} from '#src/index.js';

describe('index exports', () => {
  it('exports Subscribable', () => {
    expect(Subscribable).toBeDefined();
  });

  it('exports Subscription', () => {
    expect(Subscription).toBeDefined();
  });

  it('exports isSubscribable', () => {
    expect(isSubscribable).toBeDefined();
  });

  it('exports valuesArePrimitiveAndEqual', () => {
    expect(valuesArePrimitiveAndEqual).toBeDefined();
  });

  it('exports dependency detection functions', () => {
    expect(begin).toBeDefined();
    expect(end).toBeDefined();
    expect(registerDependency).toBeDefined();
    expect(ignore).toBeDefined();
    expect(getDependenciesCount).toBeDefined();
    expect(getDependencies).toBeDefined();
    expect(isInitial).toBeDefined();
  });

  it('exports Observable', () => {
    expect(Observable).toBeDefined();
  });

  it('exports isObservable', () => {
    expect(isObservable).toBeDefined();
  });

  it('exports isWritableObservable', () => {
    expect(isWritableObservable).toBeDefined();
  });

  it('exports ObservableArray', () => {
    expect(ObservableArray).toBeDefined();
  });

  it('exports isObservableArray', () => {
    expect(isObservableArray).toBeDefined();
  });

  it('exports DESTROY symbol', () => {
    expect(typeof DESTROY).toBe('symbol');
  });

  it('exports isDestroyed', () => {
    expect(isDestroyed).toBeDefined();
  });

  it('exports compareArrays', () => {
    expect(compareArrays).toBeDefined();
  });

  it('exports findMovesInArrayComparison', () => {
    expect(findMovesInArrayComparison).toBeDefined();
  });

  it('exports Computed', () => {
    expect(Computed).toBeDefined();
  });

  it('exports isComputed', () => {
    expect(isComputed).toBeDefined();
  });

  it('exports PureComputed', () => {
    expect(PureComputed).toBeDefined();
  });

  it('exports isPureComputed', () => {
    expect(isPureComputed).toBeDefined();
  });

  it('exports registerExtender', () => {
    expect(registerExtender).toBeDefined();
  });

  it('exports throttle', () => {
    expect(throttle).toBeDefined();
  });

  it('exports debounce', () => {
    expect(debounce).toBeDefined();
  });

  it('exports toJS', () => {
    expect(toJS).toBeDefined();
  });

  it('exports toJSON', () => {
    expect(toJSON).toBeDefined();
  });

  it('exports when', () => {
    expect(when).toBeDefined();
  });

  it('exports domData functions', () => {
    expect(domDataGet).toBeDefined();
    expect(domDataSet).toBeDefined();
    expect(domDataGetOrSet).toBeDefined();
    expect(domDataClear).toBeDefined();
    expect(domDataNextKey).toBeDefined();
  });

  it('exports domNodeDisposal functions', () => {
    expect(addDisposeCallback).toBeDefined();
    expect(removeDisposeCallback).toBeDefined();
    expect(cleanNode).toBeDefined();
    expect(removeNode).toBeDefined();
  });

  it('exports virtualElements functions', () => {
    expect(isStartComment).toBeDefined();
    expect(hasBindingValue).toBeDefined();
    expect(virtualNodeBindingValue).toBeDefined();
    expect(virtualChildNodes).toBeDefined();
    expect(virtualFirstChild).toBeDefined();
    expect(virtualNextSibling).toBeDefined();
    expect(virtualEmptyNode).toBeDefined();
    expect(virtualSetChildren).toBeDefined();
    expect(virtualPrepend).toBeDefined();
    expect(virtualInsertAfter).toBeDefined();
    expect(allowedVirtualElementBindings).toBeDefined();
  });

  it('exports expressionRewriting functions', () => {
    expect(parseObjectLiteral).toBeDefined();
    expect(preProcessBindings).toBeDefined();
    expect(twoWayBindings).toBeDefined();
    expect(writeValueToProperty).toBeDefined();
    expect(keyValueArrayContainsKey).toBeDefined();
  });

  it('exports tasks functions', () => {
    expect(schedule).toBeDefined();
    expect(cancel).toBeDefined();
    expect(runEarly).toBeDefined();
    expect(resetForTesting).toBeDefined();
  });

  it('exports tasks namespace', () => {
    expect(tasks).toBeDefined();
    expect(tasks.schedule).toBe(schedule);
    expect(tasks.cancel).toBe(cancel);
    expect(tasks.runEarly).toBe(runEarly);
    expect(tasks.resetForTesting).toBe(resetForTesting);
  });

  it('exports BindingContext', () => {
    expect(BindingContext).toBeDefined();
  });

  it('exports context retrieval functions', () => {
    expect(contextFor).toBeDefined();
    expect(dataFor).toBeDefined();
    expect(storedBindingContextForNode).toBeDefined();
  });

  it('exports binding context symbols and keys', () => {
    expect(typeof SUBSCRIBABLE).toBe('symbol');
    expect(typeof ANCESTOR_BINDING_INFO).toBe('symbol');
    expect(typeof DATA_DEPENDENCY).toBe('symbol');
    expect(typeof BINDING_INFO_KEY).toBe('string');
  });

  it('exports BindingProvider', () => {
    expect(BindingProvider).toBeDefined();
  });

  it('exports binding handler registry', () => {
    expect(bindingHandlers).toBeDefined();
    expect(getBindingHandler).toBeDefined();
  });

  it('exports binding provider singleton instance', () => {
    expect(bindingProviderInstance).toBeInstanceOf(BindingProvider);
  });
});
