import * as core from '#src/core.js';
import * as full from '#src/index.js';

describe('tapout/core entry point', () => {
  it('exports Observable', () => {
    expect(core.Observable).toBeDefined();
    expect(typeof core.isObservable).toBe('function');
  });

  it('exports ObservableArray', () => {
    expect(core.ObservableArray).toBeDefined();
    expect(typeof core.isObservableArray).toBe('function');
  });

  it('exports Computed and PureComputed', () => {
    expect(core.Computed).toBeDefined();
    expect(core.PureComputed).toBeDefined();
    expect(typeof core.isComputed).toBe('function');
    expect(typeof core.isPureComputed).toBe('function');
  });

  it('exports Subscribable and Subscription', () => {
    expect(core.Subscribable).toBeDefined();
    expect(core.Subscription).toBeDefined();
    expect(typeof core.isSubscribable).toBe('function');
  });

  it('exports Event system', () => {
    expect(core.Event).toBeDefined();
    expect(core.EventSubscribable).toBeDefined();
    expect(core.EventSubscription).toBeDefined();
    expect(core.AggregateEvent).toBeDefined();
    expect(typeof core.isEvent).toBe('function');
  });

  it('exports DisposableGroup', () => {
    expect(core.DisposableGroup).toBeDefined();
  });

  it('exports effects', () => {
    expect(typeof core.effect).toBe('function');
    expect(typeof core.observe).toBe('function');
  });

  it('exports extenders', () => {
    expect(typeof core.registerExtender).toBe('function');
    expect(typeof core.throttle).toBe('function');
    expect(typeof core.debounce).toBe('function');
  });

  it('exports decorators', () => {
    expect(typeof core.reactive).toBe('function');
    expect(typeof core.reactiveArray).toBe('function');
    expect(typeof core.computed).toBe('function');
    expect(typeof core.getObservable).toBe('function');
  });

  it('exports dependency detection', () => {
    expect(typeof core.begin).toBe('function');
    expect(typeof core.end).toBe('function');
    expect(typeof core.ignore).toBe('function');
  });

  it('exports pure utility functions', () => {
    expect(typeof core.unwrapObservable).toBe('function');
    expect(typeof core.peekObservable).toBe('function');
    expect(typeof core.toJS).toBe('function');
    expect(typeof core.toJSON).toBe('function');
    expect(typeof core.when).toBe('function');
    expect(typeof core.catchFunctionErrors).toBe('function');
  });

  it('exports task scheduler', () => {
    expect(typeof core.schedule).toBe('function');
    expect(typeof core.cancel).toBe('function');
    expect(typeof core.runEarly).toBe('function');
    expect(core.tasks).toBeDefined();
  });

  it('exports isWritableObservable', () => {
    expect(typeof core.isWritableObservable).toBe('function');
  });

  it('exports compareArrays', () => {
    expect(typeof core.compareArrays).toBe('function');
  });

  it('exports options and version', () => {
    expect(core.options).toBeDefined();
    expect(typeof core.version).toBe('string');
  });

  it('does NOT export DOM binding APIs', () => {
    expect((core as Record<string, unknown>)['applyBindings']).toBeUndefined();
    expect((core as Record<string, unknown>)['bindingHandlers']).toBeUndefined();
    expect((core as Record<string, unknown>)['BindingProvider']).toBeUndefined();
    expect((core as Record<string, unknown>)['BindingContext']).toBeUndefined();
  });

  it('does NOT export template/component APIs', () => {
    expect((core as Record<string, unknown>)['renderTemplate']).toBeUndefined();
    expect((core as Record<string, unknown>)['TemplateEngine']).toBeUndefined();
    expect((core as Record<string, unknown>)['components']).toBeUndefined();
    expect((core as Record<string, unknown>)['component']).toBeUndefined();
  });

  it('does NOT export DOM utility functions', () => {
    expect((core as Record<string, unknown>)['cloneNodes']).toBeUndefined();
    expect((core as Record<string, unknown>)['parseHtmlFragment']).toBeUndefined();
    expect((core as Record<string, unknown>)['replaceDomNodes']).toBeUndefined();
    expect((core as Record<string, unknown>)['domNodeIsAttachedToDocument']).toBeUndefined();
  });

  it('full entry point is a superset of core', () => {
    const coreKeys = Object.keys(core);
    for (const key of coreKeys) {
      expect((full as Record<string, unknown>)[key]).toBeDefined(`expected '${key}' in full export`);
    }
  });
});
