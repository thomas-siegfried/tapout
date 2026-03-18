import {
  Observable,
  Computed,
} from '#src/index.js';

describe('Computed — deferEvaluation', () => {
  describe('lazy initial evaluation', () => {
    it('does NOT evaluate on construction', () => {
      let evalCount = 0;
      new Computed({
        read: () => { evalCount++; return 1; },
        deferEvaluation: true,
      });
      expect(evalCount).toBe(0);
    });

    it('evaluates on first get()', () => {
      let evalCount = 0;
      const comp = new Computed({
        read: () => { evalCount++; return 42; },
        deferEvaluation: true,
      });
      expect(evalCount).toBe(0);
      expect(comp.get()).toBe(42);
      expect(evalCount).toBe(1);
    });

    it('evaluates on first peek() when no prior deps', () => {
      let evalCount = 0;
      const comp = new Computed({
        read: () => { evalCount++; return 99; },
        deferEvaluation: true,
      });
      expect(evalCount).toBe(0);
      expect(comp.peek()).toBe(99);
      expect(evalCount).toBe(1);
    });
  });

  describe('evaluation on subscribe', () => {
    it('evaluates when first change subscriber is added', () => {
      let evalCount = 0;
      const dep = new Observable(10);
      const comp = new Computed({
        read: () => { evalCount++; return dep.get(); },
        deferEvaluation: true,
      });
      expect(evalCount).toBe(0);
      comp.subscribe(() => {});
      expect(evalCount).toBe(1);
    });

    it('evaluates when first beforeChange subscriber is added', () => {
      let evalCount = 0;
      const comp = new Computed({
        read: () => { evalCount++; return 1; },
        deferEvaluation: true,
      });
      expect(evalCount).toBe(0);
      comp.subscribe(() => {}, 'beforeChange');
      expect(evalCount).toBe(1);
    });

    it('does NOT evaluate for spectate subscriber', () => {
      let evalCount = 0;
      new Computed({
        read: () => { evalCount++; return 1; },
        deferEvaluation: true,
      });
      expect(evalCount).toBe(0);
    });
  });

  describe('dependency tracking', () => {
    it('tracks dependencies after deferred evaluation', () => {
      const dep = new Observable(1);
      const comp = new Computed({
        read: () => dep.get() * 2,
        deferEvaluation: true,
      });

      comp.subscribe(() => {});
      expect(comp.getDependenciesCount()).toBe(1);
    });

    it('re-evaluates when a dependency changes', () => {
      const dep = new Observable(1);
      const comp = new Computed({
        read: () => dep.get() * 2,
        deferEvaluation: true,
      });
      const values: number[] = [];
      comp.subscribe((v) => values.push(v));

      dep.set(5);
      expect(values).toEqual([10]);
    });
  });

  describe('writable deferred computed', () => {
    it('supports read and write with deferEvaluation', () => {
      const backing = new Observable('hello');
      const comp = new Computed({
        read: () => backing.get(),
        write: (val: string) => backing.set(val),
        deferEvaluation: true,
      });

      expect(comp.get()).toBe('hello');
      comp.set('world');
      expect(comp.get()).toBe('world');
      expect(backing.get()).toBe('world');
    });
  });

  describe('differences from PureComputed', () => {
    it('does NOT sleep/wake like PureComputed', () => {
      const dep = new Observable(1);
      const comp = new Computed({
        read: () => dep.get(),
        deferEvaluation: true,
      });

      expect(comp.isPure).toBe(false);

      const sub = comp.subscribe(() => {});
      expect(comp.getDependenciesCount()).toBe(1);

      sub.dispose();
      expect(comp.getDependenciesCount()).toBe(1);
    });
  });
});
