import { Observable, Computed, PureComputed } from '#src/index.js';
import { runEarly, resetForTesting } from '#src/tasks.js';

describe('deferred extender', () => {

  afterEach(() => {
    resetForTesting();
  });

  describe('on Observable', () => {
    it('sets _deferUpdates to true', () => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });
      expect((obs as any)._deferUpdates).toBe(true);
    });

    it('only accepts true as the option value', () => {
      const obs = new Observable(1);
      expect(() => obs.extend({ deferred: false as any })).toThrowError(/only accepts the value 'true'/);
    });

    it('defers change notifications to a microtask', (done) => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });
      let notified = false;
      obs.subscribe(() => { notified = true; });
      obs.set(2);
      expect(notified).toBe(false);
      setTimeout(() => {
        expect(notified).toBe(true);
        done();
      }, 50);
    });

    it('batches multiple writes into a single notification', () => {
      const obs = new Observable('a');
      obs.extend({ deferred: true });
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

    it('fires dirty event synchronously', () => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });
      let dirtyCount = 0;
      obs.subscribe(() => { dirtyCount++; }, 'dirty');

      obs.set(2);
      expect(dirtyCount).toBe(1);

      obs.set(3);
      expect(dirtyCount).toBe(2);
    });

    it('does not notify if final value is same as original', () => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });
      let notifyCount = 0;
      obs.subscribe(() => { notifyCount++; });

      obs.set(2);
      obs.set(1);
      runEarly();

      expect(notifyCount).toBe(0);
    });

    it('can be flushed with runEarly', () => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });
      let notified = false;
      obs.subscribe(() => { notified = true; });
      obs.set(2);
      expect(notified).toBe(false);
      runEarly();
      expect(notified).toBe(true);
    });
  });

  describe('on Computed', () => {
    it('defers computed re-evaluation', () => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });
      let evalCount = 0;
      const comp = new Computed(() => {
        evalCount++;
        return obs.get() * 2;
      });

      const initialEvals = evalCount;
      obs.set(5);
      expect(evalCount).toBe(initialEvals);

      runEarly();
      expect(comp.get()).toBe(10);
    });

    it('batches multiple changes to the same observable into one re-evaluation', () => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });

      let evalCount = 0;
      const comp = new Computed(() => {
        evalCount++;
        return obs.get() * 2;
      });

      evalCount = 0;
      obs.set(2);
      obs.set(3);
      obs.set(4);
      runEarly();

      expect(evalCount).toBe(1);
      expect(comp.get()).toBe(8);
    });

    it('evaluates once per deferred dependency that changed', () => {
      const a = new Observable(1);
      const b = new Observable(2);
      a.extend({ deferred: true });
      b.extend({ deferred: true });

      let evalCount = 0;
      const comp = new Computed(() => {
        evalCount++;
        return a.get() + b.get();
      });

      evalCount = 0;
      a.set(10);
      b.set(20);
      runEarly();

      expect(evalCount).toBeLessThanOrEqual(2);
      expect(comp.get()).toBe(30);
    });

    it('computed with deferred extender batches its own notifications', () => {
      const obs = new Observable(1);
      const comp = new Computed(() => obs.get() * 2);
      comp.extend({ deferred: true });

      let notifyCount = 0;
      comp.subscribe(() => { notifyCount++; });

      obs.set(2);
      obs.set(3);
      obs.set(4);
      runEarly();

      expect(notifyCount).toBe(1);
      expect(comp.get()).toBe(8);
    });
  });

  describe('on PureComputed', () => {
    it('works with pure computed', () => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });

      let evalCount = 0;
      const comp = new PureComputed(() => {
        evalCount++;
        return obs.get() + 10;
      });

      comp.subscribe(() => {});
      evalCount = 0;

      obs.set(5);
      expect(evalCount).toBe(0);

      runEarly();
      expect(comp.get()).toBe(15);
    });
  });

  describe('interaction with rateLimit', () => {
    it('rateLimit supersedes deferred', () => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });
      expect((obs as any)._deferUpdates).toBe(true);

      obs.extend({ rateLimit: 50 });
      expect((obs as any)._deferUpdates).toBe(false);
    });
  });

  describe('applying deferred twice', () => {
    it('is a no-op the second time', () => {
      const obs = new Observable(1);
      obs.extend({ deferred: true });
      obs.extend({ deferred: true });

      let notifyCount = 0;
      obs.subscribe(() => { notifyCount++; });

      obs.set(2);
      runEarly();

      expect(notifyCount).toBe(1);
    });
  });
});
