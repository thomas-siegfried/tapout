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
});
