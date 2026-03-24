import { Observable, effect, observe } from '#src/index.js';

describe('observe', () => {
  it('calls the action when a dependency changes', () => {
    const obs = new Observable(1);
    const values: number[] = [];

    observe(() => obs.get(), val => values.push(val));

    expect(values).toEqual([]);

    obs.set(2);
    expect(values).toEqual([2]);

    obs.set(3);
    expect(values).toEqual([2, 3]);
  });

  it('does not call the action immediately', () => {
    const obs = new Observable('hello');
    const spy = jasmine.createSpy('act');

    observe(() => obs.get(), spy);

    expect(spy).not.toHaveBeenCalled();
  });

  it('fires even when the computed result is unchanged (notify: always)', () => {
    const obs = new Observable(1);
    let count = 0;

    // Computed always returns the same value, but should still fire on dependency change
    observe(() => { obs.get(); return 'constant'; }, () => count++);

    obs.set(2);
    expect(count).toBe(1);

    obs.set(3);
    expect(count).toBe(2);
  });

  it('stops firing after dispose', () => {
    const obs = new Observable(1);
    const values: number[] = [];

    const handle = observe(() => obs.get(), val => values.push(val));

    obs.set(2);
    expect(values).toEqual([2]);

    handle.dispose();

    obs.set(3);
    expect(values).toEqual([2]);
  });

  it('tracks multiple dependencies', () => {
    const a = new Observable(1);
    const b = new Observable(10);
    const values: number[] = [];

    observe(() => a.get() + b.get(), val => values.push(val));

    a.set(2);
    expect(values).toEqual([12]);

    b.set(20);
    expect(values).toEqual([12, 22]);
  });
});

describe('effect', () => {
  it('calls the action immediately with the current value', () => {
    const obs = new Observable(42);
    const values: number[] = [];

    effect(() => obs.get(), val => values.push(val));

    expect(values).toEqual([42]);
  });

  it('calls the action on subsequent changes', () => {
    const obs = new Observable('a');
    const values: string[] = [];

    effect(() => obs.get(), val => values.push(val));

    expect(values).toEqual(['a']);

    obs.set('b');
    expect(values).toEqual(['a', 'b']);

    obs.set('c');
    expect(values).toEqual(['a', 'b', 'c']);
  });

  it('stops firing after dispose', () => {
    const obs = new Observable(1);
    const values: number[] = [];

    const handle = effect(() => obs.get(), val => values.push(val));

    expect(values).toEqual([1]);

    obs.set(2);
    expect(values).toEqual([1, 2]);

    handle.dispose();

    obs.set(3);
    expect(values).toEqual([1, 2]);
  });

  it('works with a computed expression over multiple observables', () => {
    const first = new Observable('Jane');
    const last = new Observable('Doe');
    const values: string[] = [];

    effect(() => `${first.get()} ${last.get()}`, val => values.push(val));

    expect(values).toEqual(['Jane Doe']);

    first.set('John');
    expect(values).toEqual(['Jane Doe', 'John Doe']);

    last.set('Smith');
    expect(values).toEqual(['Jane Doe', 'John Doe', 'John Smith']);
  });
});
