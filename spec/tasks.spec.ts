import { schedule, cancel, runEarly, resetForTesting } from '#src/tasks.js';

describe('tasks', () => {

  afterEach(() => {
    resetForTesting();
  });

  describe('schedule', () => {
    it('returns a numeric handle', () => {
      const handle = schedule(() => {});
      expect(typeof handle).toBe('number');
      runEarly();
    });

    it('runs the callback asynchronously', (done) => {
      let called = false;
      schedule(() => { called = true; });
      expect(called).toBe(false);
      setTimeout(() => {
        expect(called).toBe(true);
        done();
      }, 50);
    });

    it('runs multiple callbacks in order', () => {
      const log: number[] = [];
      schedule(() => log.push(1));
      schedule(() => log.push(2));
      schedule(() => log.push(3));
      runEarly();
      expect(log).toEqual([1, 2, 3]);
    });

    it('handles tasks scheduled during processing', () => {
      const log: string[] = [];
      schedule(() => {
        log.push('first');
        schedule(() => log.push('nested'));
      });
      runEarly();
      expect(log).toEqual(['first', 'nested']);
    });
  });

  describe('cancel', () => {
    it('prevents a scheduled callback from executing', () => {
      let called = false;
      const handle = schedule(() => { called = true; });
      cancel(handle);
      runEarly();
      expect(called).toBe(false);
    });

    it('does not affect other scheduled callbacks', () => {
      const log: string[] = [];
      schedule(() => log.push('a'));
      const handle = schedule(() => log.push('b'));
      schedule(() => log.push('c'));
      cancel(handle);
      runEarly();
      expect(log).toEqual(['a', 'c']);
    });

    it('is safe to call with an invalid handle', () => {
      expect(() => cancel(999999)).not.toThrow();
    });
  });

  describe('runEarly', () => {
    it('synchronously flushes pending tasks', () => {
      let called = false;
      schedule(() => { called = true; });
      expect(called).toBe(false);
      runEarly();
      expect(called).toBe(true);
    });

    it('is a no-op when no tasks are pending', () => {
      expect(() => runEarly()).not.toThrow();
    });
  });

  describe('resetForTesting', () => {
    it('returns the number of pending tasks', () => {
      schedule(() => {});
      schedule(() => {});
      schedule(() => {});
      const count = resetForTesting();
      expect(count).toBe(3);
    });

    it('clears the queue so tasks do not run', (done) => {
      let called = false;
      schedule(() => { called = true; });
      resetForTesting();
      setTimeout(() => {
        expect(called).toBe(false);
        done();
      }, 50);
    });

    it('returns 0 when no tasks are pending', () => {
      expect(resetForTesting()).toBe(0);
    });
  });

  describe('recursion guard', () => {
    it('stops runaway recursion after 5000 task groups', () => {
      let count = 0;

      // Replace deferError's setTimeout so the thrown error doesn't leak
      // into Jasmine's uncaught exception handler.
      const origSetTimeout = globalThis.setTimeout;
      const deferredErrors: unknown[] = [];
      globalThis.setTimeout = ((fn: () => void, ms?: number) => {
        if (ms === 0) {
          // Capture but don't execute -- this is deferError's setTimeout(throw, 0)
          deferredErrors.push(fn);
          return 0 as unknown as ReturnType<typeof setTimeout>;
        }
        return origSetTimeout(fn, ms);
      }) as typeof globalThis.setTimeout;

      try {
        function recurse() {
          count++;
          schedule(recurse);
        }
        schedule(recurse);
        runEarly();
      } finally {
        globalThis.setTimeout = origSetTimeout;
      }

      expect(count).toBeGreaterThanOrEqual(5000);
      expect(deferredErrors.length).toBeGreaterThan(0);
    });
  });
});
