import {
  Observable,
  Subscribable,
  isObservable,
  begin,
  end,
} from '#src/index.js';

describe('Observable', () => {
  describe('construction', () => {
    it('stores and returns the initial value', () => {
      const obs = new Observable(42);
      expect(obs.get()).toBe(42);
    });

    it('accepts undefined as initial value', () => {
      const obs = new Observable<string | undefined>(undefined);
      expect(obs.get()).toBeUndefined();
    });

    it('accepts null as initial value', () => {
      const obs = new Observable<string | null>(null);
      expect(obs.get()).toBeNull();
    });
  });

  describe('get', () => {
    it('registers a dependency when read inside a tracking frame', () => {
      const obs = new Observable(10);
      const deps: Subscribable<unknown>[] = [];

      begin({ callback: (s) => deps.push(s) });
      try {
        obs.get();
      } finally {
        end();
      }

      expect(deps.length).toBe(1);
      expect(deps[0]).toBe(obs);
    });

    it('does not register a dependency when no frame is active', () => {
      const obs = new Observable(10);
      expect(() => obs.get()).not.toThrow();
    });
  });

  describe('peek', () => {
    it('returns the current value', () => {
      const obs = new Observable('hello');
      expect(obs.peek()).toBe('hello');
    });

    it('does not register a dependency inside a tracking frame', () => {
      const obs = new Observable(10);
      const deps: Subscribable<unknown>[] = [];

      begin({ callback: (s) => deps.push(s) });
      try {
        obs.peek();
      } finally {
        end();
      }

      expect(deps.length).toBe(0);
    });
  });

  describe('set', () => {
    it('updates the value', () => {
      const obs = new Observable(1);
      obs.set(2);
      expect(obs.get()).toBe(2);
    });

    it('notifies change subscribers with the new value', () => {
      const obs = new Observable(1);
      const values: number[] = [];
      obs.subscribe(v => values.push(v));
      obs.set(2);
      expect(values).toEqual([2]);
    });

    it('fires beforeChange with the old value before mutation', () => {
      const obs = new Observable(1);
      const beforeValues: number[] = [];
      obs.subscribe(v => beforeValues.push(v), 'beforeChange');
      obs.set(2);
      expect(beforeValues).toEqual([1]);
    });

    it('fires spectate with the new value', () => {
      const obs = new Observable(1);
      const spectateValues: number[] = [];
      obs.subscribe(v => spectateValues.push(v), 'spectate');
      obs.set(2);
      expect(spectateValues).toEqual([2]);
    });

    it('fires beforeChange before change', () => {
      const obs = new Observable(1);
      const order: string[] = [];
      obs.subscribe(() => order.push('beforeChange'), 'beforeChange');
      obs.subscribe(() => order.push('change'));
      obs.set(2);
      expect(order).toEqual(['beforeChange', 'change']);
    });

    it('fires spectate before change', () => {
      const obs = new Observable(1);
      const order: string[] = [];
      obs.subscribe(() => order.push('spectate'), 'spectate');
      obs.subscribe(() => order.push('change'));
      obs.set(2);
      expect(order).toEqual(['spectate', 'change']);
    });

    it('skips notification when setting the same primitive value', () => {
      const obs = new Observable(42);
      const values: number[] = [];
      obs.subscribe(v => values.push(v));
      obs.set(42);
      expect(values).toEqual([]);
    });

    it('skips notification for same string value', () => {
      const obs = new Observable('hello');
      const values: string[] = [];
      obs.subscribe(v => values.push(v));
      obs.set('hello');
      expect(values).toEqual([]);
    });

    it('skips notification for same boolean value', () => {
      const obs = new Observable(true);
      const count = { value: 0 };
      obs.subscribe(() => count.value++);
      obs.set(true);
      expect(count.value).toBe(0);
    });

    it('skips notification when setting null to null', () => {
      const obs = new Observable<string | null>(null);
      const count = { value: 0 };
      obs.subscribe(() => count.value++);
      obs.set(null);
      expect(count.value).toBe(0);
    });

    it('always notifies for object values even if same reference', () => {
      const obj = { a: 1 };
      const obs = new Observable(obj);
      const values: Array<{ a: number }> = [];
      obs.subscribe(v => values.push(v));
      obs.set(obj);
      expect(values.length).toBe(1);
      expect(values[0]).toBe(obj);
    });

    it('always notifies for array values even if same reference', () => {
      const arr = [1, 2, 3];
      const obs = new Observable(arr);
      const count = { value: 0 };
      obs.subscribe(() => count.value++);
      obs.set(arr);
      expect(count.value).toBe(1);
    });

    it('notifies multiple subscribers', () => {
      const obs = new Observable(1);
      const a: number[] = [];
      const b: number[] = [];
      obs.subscribe(v => a.push(v));
      obs.subscribe(v => b.push(v));
      obs.set(2);
      expect(a).toEqual([2]);
      expect(b).toEqual([2]);
    });
  });

  describe('equalityComparer', () => {
    it('always notifies when equalityComparer is set to undefined', () => {
      const obs = new Observable(42);
      obs.equalityComparer = undefined;
      const values: number[] = [];
      obs.subscribe(v => values.push(v));
      obs.set(42);
      expect(values).toEqual([42]);
    });

    it('uses custom equalityComparer when provided', () => {
      const obs = new Observable(1.0);
      obs.equalityComparer = (a, b) => Math.floor(a) === Math.floor(b);
      const values: number[] = [];
      obs.subscribe(v => values.push(v));

      obs.set(1.5);
      expect(values).toEqual([]);

      obs.set(2.0);
      expect(values).toEqual([2.0]);
    });
  });

  describe('valueHasMutated', () => {
    it('forces change notification without changing the value', () => {
      const obs = new Observable(42);
      const values: number[] = [];
      obs.subscribe(v => values.push(v));
      obs.valueHasMutated();
      expect(values).toEqual([42]);
    });

    it('fires spectate before change', () => {
      const obs = new Observable(1);
      const order: string[] = [];
      obs.subscribe(() => order.push('spectate'), 'spectate');
      obs.subscribe(() => order.push('change'));
      obs.valueHasMutated();
      expect(order).toEqual(['spectate', 'change']);
    });
  });

  describe('valueWillMutate', () => {
    it('fires beforeChange with the current value', () => {
      const obs = new Observable(10);
      const values: number[] = [];
      obs.subscribe(v => values.push(v), 'beforeChange');
      obs.valueWillMutate();
      expect(values).toEqual([10]);
    });
  });

  describe('inheritance', () => {
    it('is an instance of Subscribable', () => {
      const obs = new Observable(1);
      expect(obs instanceof Subscribable).toBe(true);
    });

    it('inherits subscribe from Subscribable', () => {
      const obs = new Observable(1);
      const sub = obs.subscribe(() => {});
      expect(sub).toBeDefined();
      expect(obs.getSubscriptionsCount()).toBe(1);
      sub.dispose();
      expect(obs.getSubscriptionsCount()).toBe(0);
    });
  });
});

describe('isObservable', () => {
  it('returns true for an Observable', () => {
    expect(isObservable(new Observable(1))).toBe(true);
  });

  it('returns false for a plain Subscribable', () => {
    expect(isObservable(new Subscribable())).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isObservable(null)).toBe(false);
    expect(isObservable(undefined)).toBe(false);
  });

  it('returns false for plain objects and primitives', () => {
    expect(isObservable({})).toBe(false);
    expect(isObservable(42)).toBe(false);
    expect(isObservable('hello')).toBe(false);
  });
});

