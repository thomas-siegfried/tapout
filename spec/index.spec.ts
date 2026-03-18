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
  Computed,
  PureComputed,
  isComputed,
  isPureComputed,
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
});
