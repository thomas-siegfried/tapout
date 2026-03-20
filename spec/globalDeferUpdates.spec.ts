import { options, Observable, ObservableArray, Computed, PureComputed } from '#src/index.js';
import { runEarly, resetForTesting } from '#src/tasks.js';

describe('options.deferUpdates', () => {
  afterEach(() => {
    options.deferUpdates = false;
    resetForTesting();
  });

  describe('Observable', () => {
    it('auto-applies deferred extender when deferUpdates is true', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      expect((obs as any)._deferUpdates).toBe(true);
    });

    it('does not auto-apply deferred when deferUpdates is false', () => {
      const obs = new Observable(1);
      expect((obs as any)._deferUpdates).toBe(false);
    });

    it('defers change notifications to microtask', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      let notified = false;
      obs.subscribe(() => { notified = true; });

      obs.set(2);
      expect(notified).toBe(false);

      runEarly();
      expect(notified).toBe(true);
    });

    it('batches multiple writes into a single notification', () => {
      options.deferUpdates = true;
      const obs = new Observable('a');
      let notifyCount = 0;
      let lastValue: string | undefined;
      obs.subscribe((val) => {
        notifyCount++;
        lastValue = val;
      });

      obs.set('b');
      obs.set('c');
      obs.set('d');
      runEarly();

      expect(notifyCount).toBe(1);
      expect(lastValue).toBe('d');
    });

    it('does not retroactively affect observables created before enabling', () => {
      const obs = new Observable(1);
      expect((obs as any)._deferUpdates).toBe(false);

      options.deferUpdates = true;

      let notified = false;
      obs.subscribe(() => { notified = true; });
      obs.set(2);
      expect(notified).toBe(true);
    });

    it('does not un-defer observables when option is turned off', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      expect((obs as any)._deferUpdates).toBe(true);

      options.deferUpdates = false;

      let notified = false;
      obs.subscribe(() => { notified = true; });
      obs.set(2);
      expect(notified).toBe(false);

      runEarly();
      expect(notified).toBe(true);
    });
  });

  describe('Computed', () => {
    it('auto-applies deferred extender when deferUpdates is true', () => {
      options.deferUpdates = true;
      const comp = new Computed(() => 1);
      expect((comp as any)._deferUpdates).toBe(true);
    });

    it('does not auto-apply deferred when deferUpdates is false', () => {
      const comp = new Computed(() => 1);
      expect((comp as any)._deferUpdates).toBe(false);
    });

    it('defers computed subscriber notifications', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      const comp = new Computed(() => obs.get() * 2);

      let notifyCount = 0;
      comp.subscribe(() => { notifyCount++; });

      obs.set(5);
      expect(notifyCount).toBe(0);

      runEarly();
      expect(notifyCount).toBe(1);
      expect(comp.get()).toBe(10);
    });

    it('batches multiple dependency changes into one subscriber notification', () => {
      options.deferUpdates = true;
      const a = new Observable(1);
      const b = new Observable(2);
      const comp = new Computed(() => a.get() + b.get());

      let notifyCount = 0;
      comp.subscribe(() => { notifyCount++; });

      a.set(10);
      b.set(20);
      runEarly();

      expect(notifyCount).toBe(1);
      expect(comp.get()).toBe(30);
    });
  });

  describe('PureComputed', () => {
    it('auto-applies deferred extender when deferUpdates is true', () => {
      options.deferUpdates = true;
      const comp = new PureComputed(() => 1);
      comp.subscribe(() => {});
      expect((comp as any)._deferUpdates).toBe(true);
    });

    it('defers pure computed subscriber notifications', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      const comp = new PureComputed(() => obs.get() + 10);

      let notifyCount = 0;
      comp.subscribe(() => { notifyCount++; });

      obs.set(5);
      expect(notifyCount).toBe(0);

      runEarly();
      expect(notifyCount).toBe(1);
      expect(comp.get()).toBe(15);
    });
  });

  describe('reading computed values synchronously', () => {
    it('returns the up-to-date value when read in code', () => {
      options.deferUpdates = true;
      const firstName = new Observable('John');
      const lastName = new Observable('Doe');
      const fullName = new Computed(() => firstName.get() + ' ' + lastName.get());

      fullName.subscribe(() => {});

      firstName.set('Jane');
      expect(fullName.get()).toBe('Jane Doe');

      lastName.set('Smith');
      expect(fullName.get()).toBe('Jane Smith');
    });

    it('re-evaluates lazily on get() even though notifications are deferred', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      let evalCount = 0;
      const comp = new Computed(() => {
        evalCount++;
        return obs.get() * 2;
      });

      comp.subscribe(() => {});
      evalCount = 0;

      obs.set(5);
      expect(evalCount).toBe(0);

      const result = comp.get();
      expect(result).toBe(10);
      expect(evalCount).toBe(1);
    });
  });

  describe('dirty cascades through computed layers', () => {
    it('marks all layers dirty synchronously', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      const layer1 = new Computed(() => obs.get() * 2);
      const layer2 = new Computed(() => layer1.get() + 10);
      const layer3 = new Computed(() => layer2.get() + 100);

      layer3.subscribe(() => {});

      obs.set(5);

      expect((layer1 as any)._isDirty).toBe(true);
      expect((layer2 as any)._isDirty).toBe(true);
      expect((layer3 as any)._isDirty).toBe(true);
    });

    it('returns correct values through multiple layers when read', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      const layer1 = new Computed(() => obs.get() * 2);
      const layer2 = new Computed(() => layer1.get() + 10);
      const layer3 = new Computed(() => layer2.get() + 100);

      layer3.subscribe(() => {});

      obs.set(5);
      expect(layer3.get()).toBe(120);
      expect(layer2.get()).toBe(20);
      expect(layer1.get()).toBe(10);
    });

    it('fires only one notification per layer after flush', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      const layer1 = new Computed(() => obs.get() * 2);
      const layer2 = new Computed(() => layer1.get() + 10);

      let layer1Count = 0;
      let layer2Count = 0;
      layer1.subscribe(() => { layer1Count++; });
      layer2.subscribe(() => { layer2Count++; });

      obs.set(5);
      obs.set(10);
      obs.set(15);
      runEarly();

      expect(layer1Count).toBe(1);
      expect(layer2Count).toBe(1);
      expect(layer1.get()).toBe(30);
      expect(layer2.get()).toBe(40);
    });
  });

  describe('interaction with manual deferred extender', () => {
    it('does not double-apply deferred if manually extended', () => {
      options.deferUpdates = true;
      const obs = new Observable(1);
      obs.extend({ deferred: true });

      let notifyCount = 0;
      obs.subscribe(() => { notifyCount++; });

      obs.set(2);
      runEarly();

      expect(notifyCount).toBe(1);
    });
  });

  describe('ObservableArray', () => {
    it('auto-defers ObservableArray when deferUpdates is true', () => {
      options.deferUpdates = true;
      const arr = new ObservableArray([1, 2, 3]);
      expect((arr as any)._deferUpdates).toBe(true);
    });

    it('defers array mutation notifications', () => {
      options.deferUpdates = true;
      const arr = new ObservableArray([1, 2, 3]);
      let notified = false;
      arr.subscribe(() => { notified = true; });

      arr.push(4);
      expect(notified).toBe(false);

      runEarly();
      expect(notified).toBe(true);
    });
  });
});
