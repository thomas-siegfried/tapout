import { options, Observable, Computed, catchFunctionErrors } from '#src/index.js';
import { runEarly, resetForTesting } from '#src/tasks.js';

describe('options.onError', () => {
  afterEach(() => {
    options.onError = null;
    options.deferUpdates = false;
    resetForTesting();
  });

  describe('task scheduler integration', () => {
    it('calls onError when a deferred task throws', () => {
      const errors: unknown[] = [];
      options.onError = (e) => { errors.push(e); };
      options.deferUpdates = true;

      const obs = new Observable(1);
      obs.subscribe(() => {
        throw new Error('subscriber error');
      });

      obs.set(2);
      runEarly();

      expect(errors.length).toBe(1);
      expect((errors[0] as Error).message).toBe('subscriber error');
    });

    it('does not re-throw when onError is set', () => {
      options.onError = () => {};
      options.deferUpdates = true;

      const obs = new Observable(1);
      obs.subscribe(() => {
        throw new Error('swallowed');
      });

      obs.set(2);
      expect(() => runEarly()).not.toThrow();
    });

    it('captures multiple errors from a single flush', () => {
      const errors: unknown[] = [];
      options.onError = (e) => { errors.push(e); };
      options.deferUpdates = true;

      const a = new Observable(1);
      const b = new Observable(1);

      a.subscribe(() => { throw new Error('error A'); });
      b.subscribe(() => { throw new Error('error B'); });

      a.set(2);
      b.set(2);
      runEarly();

      expect(errors.length).toBe(2);
      expect((errors[0] as Error).message).toBe('error A');
      expect((errors[1] as Error).message).toBe('error B');
    });

    it('continues processing tasks after an error', () => {
      const errors: unknown[] = [];
      const values: number[] = [];
      options.onError = (e) => { errors.push(e); };
      options.deferUpdates = true;

      const a = new Observable(1);
      const b = new Observable(1);

      a.subscribe(() => { throw new Error('error in a'); });
      b.subscribe((v) => { values.push(v); });

      a.set(2);
      b.set(2);
      runEarly();

      expect(errors.length).toBe(1);
      expect(values).toEqual([2]);
    });

    it('calls onError for too-much-recursion errors', () => {
      const errors: unknown[] = [];
      options.onError = (e) => { errors.push(e); };
      options.deferUpdates = true;

      const obs = new Observable(0);
      const comp = new Computed(() => obs.get());
      comp.subscribe(() => {
        if (obs.peek() < 10000) {
          obs.set(obs.peek() + 1);
        }
      });

      obs.set(1);
      runEarly();

      const recursionError = errors.find(e =>
        e instanceof Error && e.message.includes('Too much recursion'),
      );
      expect(recursionError).toBeDefined();
    });
  });

  describe('catchFunctionErrors', () => {
    it('returns delegate unchanged when onError is null', () => {
      options.onError = null;
      const fn = () => 42;
      expect(catchFunctionErrors(fn)).toBe(fn);
    });

    it('wraps delegate to call onError on throw', () => {
      const errors: unknown[] = [];
      options.onError = (e) => { errors.push(e); };

      const fn = catchFunctionErrors(() => {
        throw new Error('wrapped error');
      });

      expect(() => fn()).toThrow();
      expect(errors.length).toBe(1);
      expect((errors[0] as Error).message).toBe('wrapped error');
    });

    it('passes through return value on success', () => {
      options.onError = () => {};
      const fn = catchFunctionErrors(() => 99);
      expect(fn()).toBe(99);
    });

    it('passes arguments and this context through', () => {
      options.onError = () => {};
      const fn = catchFunctionErrors(function (this: { x: number }, a: number, b: number) {
        return this.x + a + b;
      });

      const obj = { x: 10, fn };
      expect(obj.fn(20, 30)).toBe(60);
    });

    it('re-throws the original error after calling onError', () => {
      options.onError = () => {};
      const original = new Error('original');
      const fn = catchFunctionErrors(() => { throw original; });

      try {
        fn();
        fail('should have thrown');
      } catch (e) {
        expect(e).toBe(original);
      }
    });
  });
});
