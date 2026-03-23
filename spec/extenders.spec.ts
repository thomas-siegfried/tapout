import {
  Observable,
  Computed,
  PureComputed,
} from '#src/index.js';
import { registerExtender } from '#src/extenders.js';

describe('extend()', () => {
  it('returns the same instance (chaining)', () => {
    const obs = new Observable(1);
    const result = obs.extend({ notify: 'always' });
    expect(result).toBe(obs);
  });

  it('applies multiple extenders in order', () => {
    const log: string[] = [];
    registerExtender('testA', () => { log.push('a'); });
    registerExtender('testB', () => { log.push('b'); });
    const obs = new Observable(1);
    obs.extend({ testA: true, testB: true });
    expect(log).toEqual(['a', 'b']);
  });

  it('throws on unknown extender names', () => {
    const obs = new Observable(1);
    expect(() => obs.extend({ nonExistent: true })).toThrowError("Unknown extender: 'nonExistent'");
  });

  it('works on Computed', () => {
    const comp = new Computed(() => 42);
    const result = comp.extend({ notify: 'always' });
    expect(result).toBe(comp);
  });

  it('accepts custom-registered extenders not in ExtenderMap', () => {
    let receivedValue: unknown;
    registerExtender('customThing', (_target, value) => { receivedValue = value; });

    const obs = new Observable(1);
    expect(() => obs.extend({ customThing: { threshold: 42 } })).not.toThrow();
    expect(receivedValue).toEqual({ threshold: 42 });
  });

  it('allows mixing built-in and custom extenders', () => {
    registerExtender('myLogger', () => {});

    const obs = new Observable(1);
    expect(() => obs.extend({ notify: 'always', myLogger: true })).not.toThrow();
  });
});

describe('notify extender', () => {
  it('always notifies when set to "always"', () => {
    const obs = new Observable(1);
    obs.extend({ notify: 'always' });
    const values: number[] = [];
    obs.subscribe((v) => values.push(v));
    obs.set(1);
    obs.set(1);
    expect(values).toEqual([1, 1]);
  });

  it('restores default equality when not "always"', () => {
    const obs = new Observable(1);
    obs.extend({ notify: 'always' });
    obs.extend({ notify: 'default' });
    const values: number[] = [];
    obs.subscribe((v) => values.push(v));
    obs.set(1);
    expect(values).toEqual([]);
  });

  it('works on Computed', () => {
    const dep = new Observable(5);
    const comp = new Computed(() => Math.floor(dep.get() / 10)).extend({ notify: 'always' });
    const values: number[] = [];
    comp.subscribe((v) => values.push(v));
    dep.set(6);
    dep.set(7);
    expect(values.length).toBe(2);
  });
});

describe('rateLimit extender', () => {
  beforeEach(() => {
    jasmine.clock().install();
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  describe('throttle mode (default)', () => {
    it('delays notification by the specified timeout', () => {
      const obs = new Observable(1);
      obs.extend({ rateLimit: 50 });
      const values: number[] = [];
      obs.subscribe((v) => values.push(v));

      obs.set(2);
      expect(values).toEqual([]);

      jasmine.clock().tick(50);
      expect(values).toEqual([2]);
    });

    it('coalesces rapid changes', () => {
      const obs = new Observable(1);
      obs.extend({ rateLimit: 50 });
      const values: number[] = [];
      obs.subscribe((v) => values.push(v));

      obs.set(2);
      obs.set(3);
      obs.set(4);
      expect(values).toEqual([]);

      jasmine.clock().tick(50);
      expect(values).toEqual([4]);
    });

    it('fires once during the throttle window then queues again', () => {
      const obs = new Observable(1);
      obs.extend({ rateLimit: 50 });
      const values: number[] = [];
      obs.subscribe((v) => values.push(v));

      obs.set(2);
      jasmine.clock().tick(50);
      expect(values).toEqual([2]);

      obs.set(3);
      jasmine.clock().tick(50);
      expect(values).toEqual([2, 3]);
    });

    it('does not notify if value reverts before timeout', () => {
      const obs = new Observable(1);
      obs.extend({ rateLimit: 50 });
      const values: number[] = [];
      obs.subscribe((v) => values.push(v));

      obs.set(2);
      obs.set(1);
      jasmine.clock().tick(50);
      expect(values).toEqual([]);
    });

    it('accepts options object with timeout', () => {
      const obs = new Observable(1);
      obs.extend({ rateLimit: { timeout: 100 } });
      const values: number[] = [];
      obs.subscribe((v) => values.push(v));

      obs.set(2);
      jasmine.clock().tick(50);
      expect(values).toEqual([]);
      jasmine.clock().tick(50);
      expect(values).toEqual([2]);
    });
  });

  describe('debounce mode (notifyWhenChangesStop)', () => {
    it('waits for changes to stop before notifying', () => {
      const obs = new Observable(1);
      obs.extend({ rateLimit: { timeout: 50, method: 'notifyWhenChangesStop' } });
      const values: number[] = [];
      obs.subscribe((v) => values.push(v));

      obs.set(2);
      jasmine.clock().tick(30);
      obs.set(3);
      jasmine.clock().tick(30);
      obs.set(4);
      expect(values).toEqual([]);

      jasmine.clock().tick(50);
      expect(values).toEqual([4]);
    });

    it('resets the timer on each change', () => {
      const obs = new Observable(1);
      obs.extend({ rateLimit: { timeout: 100, method: 'notifyWhenChangesStop' } });
      const values: number[] = [];
      obs.subscribe((v) => values.push(v));

      obs.set(2);
      jasmine.clock().tick(80);
      obs.set(3);
      jasmine.clock().tick(80);
      expect(values).toEqual([]);

      jasmine.clock().tick(20);
      expect(values).toEqual([3]);
    });
  });

  describe('with Computed', () => {
    it('delays computed notification', () => {
      const dep = new Observable(1);
      const comp = new Computed(() => dep.get() * 2);
      comp.extend({ rateLimit: 50 });
      const values: number[] = [];
      comp.subscribe((v) => values.push(v));

      dep.set(2);
      dep.set(3);
      expect(values).toEqual([]);

      jasmine.clock().tick(50);
      expect(values).toEqual([6]);
    });

    it('evaluates lazily when timer fires', () => {
      let evalCount = 0;
      const dep = new Observable(1);
      const comp = new Computed(() => {
        evalCount++;
        return dep.get();
      });
      comp.extend({ rateLimit: 50 });
      comp.subscribe(() => {});

      const baseCount = evalCount;
      dep.set(2);
      dep.set(3);
      dep.set(4);

      jasmine.clock().tick(50);
      expect(evalCount - baseCount).toBeLessThanOrEqual(2);
      expect(comp.peek()).toBe(4);
    });
  });

  describe('with PureComputed', () => {
    it('delays pure computed notification', () => {
      const dep = new Observable(1);
      const comp = new PureComputed(() => dep.get() + 10);
      comp.extend({ rateLimit: 50 });
      const values: number[] = [];
      comp.subscribe((v) => values.push(v));

      dep.set(2);
      expect(values).toEqual([]);

      jasmine.clock().tick(50);
      expect(values).toEqual([12]);
    });
  });

  describe('beforeChange suppression', () => {
    it('only fires beforeChange once per rate-limit cycle', () => {
      const obs = new Observable(1);
      obs.extend({ rateLimit: 50 });
      const beforeValues: number[] = [];
      obs.subscribe((v) => beforeValues.push(v), 'beforeChange');

      obs.set(2);
      obs.set(3);
      jasmine.clock().tick(50);

      expect(beforeValues).toEqual([1]);
    });
  });
});
