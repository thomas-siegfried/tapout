import {
  PureComputed,
  Computed,
  Observable,
  Subscribable,
  isPureComputed,
  isComputed,
} from '#src/index.js';

describe('PureComputed', () => {
  describe('lazy initial evaluation', () => {
    it('does not evaluate on construction', () => {
      let evalCount = 0;
      new PureComputed(() => { evalCount++; return 1; });
      expect(evalCount).toBe(0);
    });

    it('evaluates on first get()', () => {
      let evalCount = 0;
      const c = new PureComputed(() => { evalCount++; return 42; });
      expect(c.get()).toBe(42);
      expect(evalCount).toBe(1);
    });

    it('evaluates on first peek() when no prior deps', () => {
      let evalCount = 0;
      const c = new PureComputed(() => { evalCount++; return 42; });
      expect(c.peek()).toBe(42);
      expect(evalCount).toBe(1);
    });
  });

  describe('sleeping read behavior', () => {
    it('returns correct value on read', () => {
      const obs = new Observable(3);
      const c = new PureComputed(() => obs.get() * 2);
      expect(c.get()).toBe(6);
    });

    it('does not re-evaluate on repeated reads without dep changes', () => {
      const obs = new Observable(1);
      let evalCount = 0;
      const c = new PureComputed(() => { evalCount++; return obs.get(); });

      c.get();
      expect(evalCount).toBe(1);
      c.get();
      expect(evalCount).toBe(1);
    });

    it('detects staleness via version check and re-evaluates', () => {
      const obs = new Observable(1);
      let evalCount = 0;
      const c = new PureComputed(() => { evalCount++; return obs.get() * 10; });

      expect(c.get()).toBe(10);
      expect(evalCount).toBe(1);

      obs.set(2);
      expect(c.get()).toBe(20);
      expect(evalCount).toBe(2);
    });

    it('does not subscribe to dependencies while sleeping', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      c.get();
      expect(obs.getSubscriptionsCount()).toBe(0);
    });
  });

  describe('wake on subscribe', () => {
    it('wakes when a change subscriber is added', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      c.get();

      expect(obs.getSubscriptionsCount()).toBe(0);
      const sub = c.subscribe(() => {});
      expect(obs.getSubscriptionsCount()).toBe(1);
      sub.dispose();
    });

    it('does not wake for non-change event subscriptions', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      c.get();

      const sub = c.subscribe(() => {}, 'beforeChange');
      expect(obs.getSubscriptionsCount()).toBe(0);
      sub.dispose();
    });

    it('pushes notifications when awake', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get() * 2);
      const values: number[] = [];
      const sub = c.subscribe(v => values.push(v));

      obs.set(5);
      expect(values).toEqual([10]);
      sub.dispose();
    });

    it('re-evaluates on wake if deps changed since last read', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      expect(c.get()).toBe(1);

      obs.set(99);
      const values: number[] = [];
      const sub = c.subscribe(v => values.push(v));

      expect(c.get()).toBe(99);
      sub.dispose();
    });

    it('upgrades lightweight tracking to real subscriptions when deps unchanged', () => {
      const obs = new Observable(1);
      let evalCount = 0;
      const c = new PureComputed(() => { evalCount++; return obs.get(); });
      c.get();
      expect(evalCount).toBe(1);

      const sub = c.subscribe(() => {});
      expect(obs.getSubscriptionsCount()).toBe(1);
      expect(evalCount).toBe(1);
      sub.dispose();
    });
  });

  describe('sleep on last unsubscribe', () => {
    it('sleeps when the last change subscriber is removed', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      const sub = c.subscribe(() => {});
      expect(obs.getSubscriptionsCount()).toBe(1);

      sub.dispose();
      expect(obs.getSubscriptionsCount()).toBe(0);
    });

    it('disposes dependency subscriptions on sleep', () => {
      const a = new Observable(1);
      const b = new Observable(2);
      const c = new PureComputed(() => a.get() + b.get());
      const sub = c.subscribe(() => {});

      expect(a.getSubscriptionsCount()).toBe(1);
      expect(b.getSubscriptionsCount()).toBe(1);

      sub.dispose();
      expect(a.getSubscriptionsCount()).toBe(0);
      expect(b.getSubscriptionsCount()).toBe(0);
    });

    it('still returns correct value after sleeping again', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get() * 2);
      const sub = c.subscribe(() => {});
      obs.set(5);
      sub.dispose();

      expect(c.get()).toBe(10);

      obs.set(7);
      expect(c.get()).toBe(14);
    });
  });

  describe('awake and asleep events', () => {
    it('fires awake event when waking', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      c.get();

      const awakeValues: number[] = [];
      c.subscribe(v => awakeValues.push(v), 'awake');
      const sub = c.subscribe(() => {});

      expect(awakeValues.length).toBe(1);
      expect(awakeValues[0]).toBe(1);
      sub.dispose();
    });

    it('fires asleep event when sleeping', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      let asleepFired = false;
      c.subscribe(() => { asleepFired = true; }, 'asleep');

      const sub = c.subscribe(() => {});
      asleepFired = false;
      sub.dispose();
      expect(asleepFired).toBe(true);
    });
  });

  describe('version tracking while sleeping', () => {
    it('getVersion re-evaluates if stale while sleeping', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      const v1 = c.getVersion();

      obs.set(2);
      const v2 = c.getVersion();
      expect(v2).toBeGreaterThan(v1);
    });

    it('getVersion does not re-evaluate if not stale', () => {
      const obs = new Observable(1);
      let evalCount = 0;
      const c = new PureComputed(() => { evalCount++; return obs.get(); });
      c.getVersion();
      expect(evalCount).toBe(1);

      c.getVersion();
      expect(evalCount).toBe(1);
    });
  });

  describe('haveDependenciesChanged', () => {
    it('returns false when no dependencies have changed', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      c.get();
      expect(c.haveDependenciesChanged()).toBe(false);
    });

    it('returns true when a dependency has changed', () => {
      const obs = new Observable(1);
      const c = new PureComputed(() => obs.get());
      c.get();
      obs.set(2);
      expect(c.haveDependenciesChanged()).toBe(true);
    });
  });

  describe('isPure getter', () => {
    it('returns true for PureComputed', () => {
      const c = new PureComputed(() => 1);
      expect(c.isPure).toBe(true);
    });

    it('returns false for basic Computed', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      expect(c.isPure).toBe(false);
    });
  });

  describe('writable pure computed', () => {
    it('supports read and write', () => {
      const obs = new Observable(1);
      const c = new PureComputed({
        read: () => obs.get() * 2,
        write: (v: number) => obs.set(v / 2),
      });

      expect(c.get()).toBe(2);
      c.set(10);
      expect(obs.get()).toBe(5);
      expect(c.get()).toBe(10);
    });
  });

  describe('computed depending on pure computed', () => {
    it('works correctly in a chain', () => {
      const obs = new Observable(2);
      const pure = new PureComputed(() => obs.get() * 2);
      const regular = new Computed(() => pure.get() + 1);

      expect(regular.get()).toBe(5);
      obs.set(3);
      expect(regular.get()).toBe(7);
    });
  });

  describe('self-recursion guard', () => {
    it('throws when a pure computed reads itself', () => {
      let c: PureComputed<number>;
      expect(() => {
        c = new PureComputed(() => c ? c.get() + 1 : 1);
        c.get();
      }).toThrowError(/pure.*recursive/i);
    });
  });

  describe('inheritance', () => {
    it('is an instance of Computed', () => {
      const c = new PureComputed(() => 1);
      expect(c instanceof Computed).toBe(true);
    });

    it('is an instance of Subscribable', () => {
      const c = new PureComputed(() => 1);
      expect(c instanceof Subscribable).toBe(true);
    });

    it('isComputed returns true', () => {
      const c = new PureComputed(() => 1);
      expect(isComputed(c)).toBe(true);
    });
  });
});

describe('isPureComputed', () => {
  it('returns true for a PureComputed', () => {
    const c = new PureComputed(() => 1);
    expect(isPureComputed(c)).toBe(true);
  });

  it('returns true for a Computed with pure option', () => {
    const obs = new Observable(1);
    const c = new Computed({ read: () => obs.get(), pure: true });
    expect(isPureComputed(c)).toBe(true);
  });

  it('returns false for a basic Computed', () => {
    const obs = new Observable(1);
    expect(isPureComputed(new Computed(() => obs.get()))).toBe(false);
  });

  it('returns false for an Observable', () => {
    expect(isPureComputed(new Observable(1))).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isPureComputed(null)).toBe(false);
    expect(isPureComputed(undefined)).toBe(false);
  });
});
