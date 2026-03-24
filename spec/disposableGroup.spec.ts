import {
  DisposableGroup,
  Observable,
  Event,
  cleanNode,
} from '#src/index.js';
import type { Disposable } from '#src/index.js';

describe('DisposableGroup', () => {
  it('starts not disposed', () => {
    const group = new DisposableGroup();
    expect(group.isDisposed).toBe(false);
    expect(group.count).toBe(0);
  });

  it('tracks added disposables', () => {
    const group = new DisposableGroup();
    const d1: Disposable = { dispose: jasmine.createSpy('d1') };
    const d2: Disposable = { dispose: jasmine.createSpy('d2') };
    group.add(d1);
    group.add(d2);
    expect(group.count).toBe(2);
  });

  it('add returns the disposable for chaining', () => {
    const group = new DisposableGroup();
    const d: Disposable = { dispose: () => {} };
    const result = group.add(d);
    expect(result).toBe(d);
  });

  it('dispose calls dispose on all added items', () => {
    const group = new DisposableGroup();
    const spy1 = jasmine.createSpy('d1');
    const spy2 = jasmine.createSpy('d2');
    group.add({ dispose: spy1 });
    group.add({ dispose: spy2 });

    group.dispose();

    expect(spy1).toHaveBeenCalledTimes(1);
    expect(spy2).toHaveBeenCalledTimes(1);
    expect(group.isDisposed).toBe(true);
    expect(group.count).toBe(0);
  });

  it('dispose is idempotent', () => {
    const spy = jasmine.createSpy('d');
    const group = new DisposableGroup();
    group.add({ dispose: spy });

    group.dispose();
    group.dispose();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('immediately disposes items added after group is disposed', () => {
    const group = new DisposableGroup();
    group.dispose();

    const spy = jasmine.createSpy('late');
    group.add({ dispose: spy });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(group.count).toBe(0);
  });

  it('works with Subscription from Observable', () => {
    const obs = new Observable(1);
    const values: number[] = [];
    const group = new DisposableGroup();

    group.add(obs.subscribe(v => values.push(v)));

    obs.set(2);
    expect(values).toEqual([2]);

    group.dispose();

    obs.set(3);
    expect(values).toEqual([2]);
  });

  it('works with EventSubscription from Event', () => {
    const event = new Event<number>();
    const values: number[] = [];
    const group = new DisposableGroup();

    group.add(event.subscribable.subscribe(v => values.push(v)));

    event.emit(1);
    expect(values).toEqual([1]);

    group.dispose();

    event.emit(2);
    expect(values).toEqual([1]);
  });

  it('works with mixed Subscription and EventSubscription', () => {
    const obs = new Observable('a');
    const event = new Event<number>();
    const obsValues: string[] = [];
    const eventValues: number[] = [];
    const group = new DisposableGroup();

    group.add(obs.subscribe(v => obsValues.push(v)));
    group.add(event.subscribable.subscribe(v => eventValues.push(v)));

    obs.set('b');
    event.emit(1);
    expect(obsValues).toEqual(['b']);
    expect(eventValues).toEqual([1]);

    group.dispose();

    obs.set('c');
    event.emit(2);
    expect(obsValues).toEqual(['b']);
    expect(eventValues).toEqual([1]);
  });

  it('individual disposal before group disposal is safe', () => {
    const event = new Event<number>();
    const values: number[] = [];
    const group = new DisposableGroup();

    const sub = group.add(event.subscribable.subscribe(v => values.push(v)));

    event.emit(1);
    expect(values).toEqual([1]);

    sub.dispose();

    event.emit(2);
    expect(values).toEqual([1]);

    expect(() => group.dispose()).not.toThrow();
  });
});
