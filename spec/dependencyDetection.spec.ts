import {
  Subscribable,
  begin,
  end,
  registerDependency,
  ignore,
  getDependenciesCount,
  getDependencies,
  isInitial,
  type TrackingFrame,
} from '#src/index.js';

describe('dependencyDetection', () => {
  describe('registerDependency', () => {
    it('is a no-op when no frame is active', () => {
      const sub = new Subscribable<number>();
      expect(() => registerDependency(sub)).not.toThrow();
    });

    it('calls the frame callback with subscribable and id', () => {
      const sub = new Subscribable<number>();
      const deps: Array<{ subscribable: Subscribable; id: number }> = [];

      begin({
        callback: (s, id) => deps.push({ subscribable: s, id }),
      });
      try {
        registerDependency(sub);
      } finally {
        end();
      }

      expect(deps.length).toBe(1);
      expect(deps[0].subscribable).toBe(sub);
      expect(deps[0].id).toBeGreaterThan(0);
    });

    it('assigns a lazy _id on first registration', () => {
      const sub = new Subscribable<number>();
      expect(sub._id).toBeUndefined();

      begin({ callback: () => {} });
      try {
        registerDependency(sub);
      } finally {
        end();
      }

      expect(sub._id).toBeDefined();
      expect(typeof sub._id).toBe('number');
    });

    it('reuses the same _id on subsequent registrations', () => {
      const sub = new Subscribable<number>();
      const ids: number[] = [];

      begin({ callback: (_s, id) => ids.push(id) });
      try {
        registerDependency(sub);
        registerDependency(sub);
      } finally {
        end();
      }

      expect(ids[0]).toBe(ids[1]);
    });

    it('assigns unique IDs to different subscribables', () => {
      const sub1 = new Subscribable<number>();
      const sub2 = new Subscribable<number>();
      const ids: number[] = [];

      begin({ callback: (_s, id) => ids.push(id) });
      try {
        registerDependency(sub1);
        registerDependency(sub2);
      } finally {
        end();
      }

      expect(ids[0]).not.toBe(ids[1]);
    });
  });

  describe('begin / end', () => {
    it('end restores detection to inactive', () => {
      const deps: Subscribable[] = [];
      const sub = new Subscribable<number>();

      begin({ callback: (s) => deps.push(s) });
      end();

      registerDependency(sub);
      expect(deps.length).toBe(0);
    });

    it('supports nesting without corrupting outer frame', () => {
      const outerDeps: Subscribable[] = [];
      const innerDeps: Subscribable[] = [];
      const sub1 = new Subscribable<number>();
      const sub2 = new Subscribable<number>();
      const sub3 = new Subscribable<number>();

      begin({ callback: (s) => outerDeps.push(s) });
      try {
        registerDependency(sub1);

        begin({ callback: (s) => innerDeps.push(s) });
        try {
          registerDependency(sub2);
        } finally {
          end();
        }

        registerDependency(sub3);
      } finally {
        end();
      }

      expect(outerDeps).toEqual([sub1, sub3]);
      expect(innerDeps).toEqual([sub2]);
    });
  });

  describe('ignore', () => {
    it('suppresses dependency detection inside the callback', () => {
      const deps: Subscribable[] = [];
      const sub = new Subscribable<number>();

      begin({ callback: (s) => deps.push(s) });
      try {
        ignore(() => {
          registerDependency(sub);
        });
      } finally {
        end();
      }

      expect(deps.length).toBe(0);
    });

    it('restores detection after the callback completes', () => {
      const deps: Subscribable[] = [];
      const sub = new Subscribable<number>();

      begin({ callback: (s) => deps.push(s) });
      try {
        ignore(() => {});
        registerDependency(sub);
      } finally {
        end();
      }

      expect(deps.length).toBe(1);
      expect(deps[0]).toBe(sub);
    });

    it('restores detection even when the callback throws', () => {
      const deps: Subscribable[] = [];
      const sub = new Subscribable<number>();

      begin({ callback: (s) => deps.push(s) });
      try {
        try {
          ignore(() => { throw new Error('boom'); });
        } catch {
          // expected
        }
        registerDependency(sub);
      } finally {
        end();
      }

      expect(deps.length).toBe(1);
    });

    it('returns the callback return value', () => {
      const result = ignore(() => 42);
      expect(result).toBe(42);
    });
  });

  describe('context queries', () => {
    it('getDependenciesCount returns undefined when no frame is active', () => {
      expect(getDependenciesCount()).toBeUndefined();
    });

    it('getDependencies returns undefined when no frame is active', () => {
      expect(getDependencies()).toBeUndefined();
    });

    it('isInitial returns undefined when no frame is active', () => {
      expect(isInitial()).toBeUndefined();
    });

    it('getDependenciesCount delegates to frame.computed', () => {
      begin({
        callback: () => {},
        computed: {
          getDependenciesCount: () => 5,
          getDependencies: () => [],
        },
      });
      try {
        expect(getDependenciesCount()).toBe(5);
      } finally {
        end();
      }
    });

    it('getDependencies delegates to frame.computed', () => {
      const sub = new Subscribable<number>();
      begin({
        callback: () => {},
        computed: {
          getDependenciesCount: () => 1,
          getDependencies: () => [sub],
        },
      });
      try {
        expect(getDependencies()).toEqual([sub]);
      } finally {
        end();
      }
    });

    it('isInitial returns the frame isInitial value', () => {
      begin({
        callback: () => {},
        isInitial: true,
      });
      try {
        expect(isInitial()).toBe(true);
      } finally {
        end();
      }
    });

    it('getDependenciesCount returns undefined when frame has no computed', () => {
      begin({ callback: () => {} });
      try {
        expect(getDependenciesCount()).toBeUndefined();
      } finally {
        end();
      }
    });
  });

  describe('notifySubscribers suppression', () => {
    it('suppresses dependency detection during notification callbacks', () => {
      const tracked: Subscribable[] = [];
      const source = new Subscribable<number>();
      const other = new Subscribable<number>();

      source.subscribe(() => {
        registerDependency(other);
      });

      begin({ callback: (s) => tracked.push(s) });
      try {
        source.notifySubscribers(1);
      } finally {
        end();
      }

      expect(tracked).toEqual([]);
    });

    it('restores detection after notification completes', () => {
      const tracked: Subscribable[] = [];
      const source = new Subscribable<number>();
      const other = new Subscribable<number>();

      source.subscribe(() => {});

      begin({ callback: (s) => tracked.push(s) });
      try {
        source.notifySubscribers(1);
        registerDependency(other);
      } finally {
        end();
      }

      expect(tracked).toEqual([other]);
    });
  });
});
