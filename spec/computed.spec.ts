import {
  Computed,
  Observable,
  Subscribable,
  isComputed,
  begin,
  end,
} from '#src/index.js';

describe('Computed', () => {
  describe('construction and evaluation', () => {
    it('evaluates immediately on construction', () => {
      let evalCount = 0;
      const c = new Computed(() => { evalCount++; return 42; });
      expect(evalCount).toBe(1);
      expect(c.get()).toBe(42);
    });

    it('caches the evaluated value', () => {
      let evalCount = 0;
      const c = new Computed(() => { evalCount++; return 'hello'; });
      c.get();
      c.get();
      expect(evalCount).toBe(1);
    });

    it('is an instance of Subscribable', () => {
      const c = new Computed(() => 1);
      expect(c instanceof Subscribable).toBe(true);
    });
  });

  describe('get', () => {
    it('returns the computed value', () => {
      const obs = new Observable(3);
      const c = new Computed(() => obs.get() * 2);
      expect(c.get()).toBe(6);
    });

    it('registers as a dependency when read inside a tracking frame', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      const deps: Subscribable<unknown>[] = [];

      begin({ callback: (s) => deps.push(s) });
      try {
        c.get();
      } finally {
        end();
      }

      expect(deps.length).toBe(1);
      expect(deps[0]).toBe(c);
    });

    it('does not register as a dependency after disposal', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      c.dispose();

      const deps: Subscribable<unknown>[] = [];
      begin({ callback: (s) => deps.push(s) });
      try {
        c.get();
      } finally {
        end();
      }

      expect(deps.length).toBe(0);
    });
  });

  describe('peek', () => {
    it('returns the cached value without registering a dependency', () => {
      const obs = new Observable(5);
      const c = new Computed(() => obs.get() + 1);
      const deps: Subscribable<unknown>[] = [];

      begin({ callback: (s) => deps.push(s) });
      try {
        expect(c.peek()).toBe(6);
      } finally {
        end();
      }

      expect(deps.length).toBe(0);
    });
  });

  describe('automatic re-evaluation', () => {
    it('re-evaluates when a dependency changes', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get() * 10);
      expect(c.get()).toBe(10);

      obs.set(2);
      expect(c.get()).toBe(20);
    });

    it('notifies subscribers when value changes', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get() * 2);
      const values: number[] = [];
      c.subscribe(v => values.push(v));

      obs.set(5);
      expect(values).toEqual([10]);
    });

    it('does not notify subscribers when value does not change', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get() > 0 ? 'positive' : 'non-positive');
      const values: string[] = [];
      c.subscribe(v => values.push(v));

      obs.set(2);
      expect(values).toEqual([]);
    });

    it('fires beforeChange with old value before change notification', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get() * 2);
      const order: Array<{ event: string; value: number }> = [];

      c.subscribe(v => order.push({ event: 'beforeChange', value: v }), 'beforeChange');
      c.subscribe(v => order.push({ event: 'change', value: v }));

      obs.set(5);
      expect(order).toEqual([
        { event: 'beforeChange', value: 2 },
        { event: 'change', value: 10 },
      ]);
    });

    it('fires spectate with new value', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get() * 2);
      const spectateValues: number[] = [];
      c.subscribe(v => spectateValues.push(v), 'spectate');

      obs.set(5);
      expect(spectateValues).toEqual([10]);
    });

    it('does not fire change on initial evaluation', () => {
      const obs = new Observable(1);
      const values: number[] = [];

      const c = new Computed(() => obs.get());
      c.subscribe(v => values.push(v));

      expect(values).toEqual([]);
    });
  });

  describe('dependency tracking', () => {
    it('tracks multiple dependencies', () => {
      const a = new Observable(1);
      const b = new Observable(2);
      const c = new Computed(() => a.get() + b.get());

      expect(c.getDependenciesCount()).toBe(2);
      expect(c.getDependencies()).toEqual([a, b]);
      expect(c.get()).toBe(3);
    });

    it('re-evaluates when any dependency changes', () => {
      const a = new Observable(1);
      const b = new Observable(2);
      const c = new Computed(() => a.get() + b.get());

      a.set(10);
      expect(c.get()).toBe(12);

      b.set(20);
      expect(c.get()).toBe(30);
    });

    it('handles conditional dependencies (adds new deps)', () => {
      const flag = new Observable(true);
      const a = new Observable(1);
      const b = new Observable(2);
      const c = new Computed(() => flag.get() ? a.get() : b.get());

      expect(c.get()).toBe(1);
      expect(c.getDependenciesCount()).toBe(2);

      flag.set(false);
      expect(c.get()).toBe(2);
      expect(c.getDependenciesCount()).toBe(2);
    });

    it('disposes stale dependencies when they are no longer read', () => {
      const flag = new Observable(true);
      const a = new Observable(1);
      const b = new Observable(2);
      const c = new Computed(() => flag.get() ? a.get() : b.get());

      expect(c.getDependenciesCount()).toBe(2);

      flag.set(false);
      expect(c.getDependenciesCount()).toBe(2);

      const values: number[] = [];
      c.subscribe(v => values.push(v));

      a.set(99);
      expect(values).toEqual([]);
      expect(c.get()).toBe(2);
    });

    it('reuses existing subscriptions for deps that persist across evaluations', () => {
      const obs = new Observable(1);
      let evalCount = 0;
      const c = new Computed(() => { evalCount++; return obs.get(); });

      expect(evalCount).toBe(1);
      const subsCountBefore = obs.getSubscriptionsCount();

      obs.set(2);
      expect(evalCount).toBe(2);
      expect(obs.getSubscriptionsCount()).toBe(subsCountBefore);
    });

    it('supports computed depending on another computed', () => {
      const obs = new Observable(2);
      const doubled = new Computed(() => obs.get() * 2);
      const quadrupled = new Computed(() => doubled.get() * 2);

      expect(quadrupled.get()).toBe(8);

      obs.set(3);
      expect(doubled.get()).toBe(6);
      expect(quadrupled.get()).toBe(12);
    });

    it('notifies through a chain of computeds', () => {
      const obs = new Observable(1);
      const c1 = new Computed(() => obs.get() + 1);
      const c2 = new Computed(() => c1.get() + 1);
      const values: number[] = [];
      c2.subscribe(v => values.push(v));

      obs.set(10);
      expect(values).toEqual([12]);
    });
  });

  describe('auto-disposal on zero dependencies', () => {
    it('auto-disposes when evaluator has no observable dependencies', () => {
      const c = new Computed(() => 42);
      expect(c.getDependenciesCount()).toBe(0);
      expect(c.isActive()).toBe(false);
      expect(c.get()).toBe(42);
    });

    it('returns cached value after auto-disposal', () => {
      const c = new Computed(() => Math.random());
      const firstValue = c.get();
      expect(c.get()).toBe(firstValue);
    });
  });

  describe('re-entrancy protection', () => {
    it('does not recursively re-evaluate', () => {
      const obs = new Observable(1);
      let evalCount = 0;

      const c = new Computed(() => {
        evalCount++;
        if (evalCount < 5) {
          obs.set(obs.peek() + 1);
        }
        return obs.peek();
      });

      expect(evalCount).toBeGreaterThanOrEqual(1);
      expect(evalCount).toBeLessThan(10);
    });
  });

  describe('dispose', () => {
    it('stops re-evaluation when dependencies change', () => {
      const obs = new Observable(1);
      let evalCount = 0;
      const c = new Computed(() => { evalCount++; return obs.get(); });
      expect(evalCount).toBe(1);

      c.dispose();
      obs.set(2);
      expect(evalCount).toBe(1);
      expect(c.get()).toBe(1);
    });

    it('is idempotent', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      c.dispose();
      expect(() => c.dispose()).not.toThrow();
    });

    it('unsubscribes from all dependencies', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      const subsBefore = obs.getSubscriptionsCount();

      c.dispose();
      expect(obs.getSubscriptionsCount()).toBe(subsBefore - 1);
    });

    it('sets isActive to false', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      expect(c.isActive()).toBe(true);

      c.dispose();
      expect(c.isActive()).toBe(false);
    });
  });

  describe('getDependenciesCount and getDependencies', () => {
    it('returns 0 for a computed with no observable deps', () => {
      const c = new Computed(() => 42);
      expect(c.getDependenciesCount()).toBe(0);
    });

    it('returns correct count', () => {
      const a = new Observable(1);
      const b = new Observable(2);
      const c = new Computed(() => a.get() + b.get());
      expect(c.getDependenciesCount()).toBe(2);
    });

    it('returns dependencies in discovery order', () => {
      const a = new Observable(1);
      const b = new Observable(2);
      const c = new Observable(3);
      const comp = new Computed(() => c.get() + a.get() + b.get());
      expect(comp.getDependencies()).toEqual([c, a, b]);
    });
  });

  describe('isActive', () => {
    it('returns true when has dependencies', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      expect(c.isActive()).toBe(true);
    });

    it('returns false after disposal', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      c.dispose();
      expect(c.isActive()).toBe(false);
    });
  });

  describe('equalityComparer', () => {
    it('uses valuesArePrimitiveAndEqual by default', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get() > 0 ? 'yes' : 'no');
      const values: string[] = [];
      c.subscribe(v => values.push(v));

      obs.set(2);
      expect(values).toEqual([]);
    });

    it('can be overridden', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get() > 0 ? 'yes' : 'no');
      c.equalityComparer = undefined;
      const values: string[] = [];
      c.subscribe(v => values.push(v));

      obs.set(2);
      expect(values).toEqual(['yes']);
    });
  });
});

describe('isComputed', () => {
  it('returns true for a Computed', () => {
    const c = new Computed(() => 1);
    expect(isComputed(c)).toBe(true);
  });

  it('returns false for an Observable', () => {
    expect(isComputed(new Observable(1))).toBe(false);
  });

  it('returns false for a Subscribable', () => {
    expect(isComputed(new Subscribable())).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isComputed(null)).toBe(false);
    expect(isComputed(undefined)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isComputed(42)).toBe(false);
    expect(isComputed('hello')).toBe(false);
  });
});
