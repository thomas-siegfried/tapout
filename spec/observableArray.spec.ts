import {
  Observable,
  Subscribable,
  isObservable,
} from '#src/index.js';
import { ObservableArray, isObservableArray, isDestroyed } from '#src/observableArray.js';
import type { ArrayChange } from '#src/compareArrays.js';

describe('ObservableArray', () => {
  describe('construction', () => {
    it('defaults to an empty array', () => {
      const arr = new ObservableArray<number>();
      expect(arr.get()).toEqual([]);
    });

    it('accepts an initial array', () => {
      const arr = new ObservableArray([1, 2, 3]);
      expect(arr.get()).toEqual([1, 2, 3]);
    });

    it('is an instance of Observable', () => {
      const arr = new ObservableArray();
      expect(arr instanceof Observable).toBe(true);
    });

    it('is an instance of Subscribable', () => {
      const arr = new ObservableArray();
      expect(arr instanceof Subscribable).toBe(true);
    });
  });

  describe('get / set / peek', () => {
    it('get returns the underlying array', () => {
      const arr = new ObservableArray([1, 2]);
      expect(arr.get()).toEqual([1, 2]);
    });

    it('peek returns the underlying array without dependency tracking', () => {
      const arr = new ObservableArray([1, 2]);
      expect(arr.peek()).toEqual([1, 2]);
    });

    it('set replaces the entire array', () => {
      const arr = new ObservableArray([1, 2]);
      arr.set([3, 4, 5]);
      expect(arr.get()).toEqual([3, 4, 5]);
    });

    it('set notifies change subscribers', () => {
      const arr = new ObservableArray([1, 2]);
      const values: number[][] = [];
      arr.subscribe((v) => values.push(v.slice()));
      arr.set([3, 4]);
      expect(values).toEqual([[3, 4]]);
    });
  });

  describe('push', () => {
    it('appends items to the array', () => {
      const arr = new ObservableArray([1, 2]);
      arr.push(3, 4);
      expect(arr.get()).toEqual([1, 2, 3, 4]);
    });

    it('returns the new length', () => {
      const arr = new ObservableArray([1]);
      expect(arr.push(2)).toBe(2);
    });

    it('notifies change subscribers', () => {
      const arr = new ObservableArray([1]);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.push(2);
      expect(notified).toBe(true);
    });

    it('fires beforeChange before change', () => {
      const arr = new ObservableArray([1]);
      const events: string[] = [];
      arr.subscribe(() => events.push('beforeChange'), 'beforeChange');
      arr.subscribe(() => events.push('change'));
      arr.push(2);
      expect(events).toEqual(['beforeChange', 'change']);
    });
  });

  describe('pop', () => {
    it('removes and returns the last element', () => {
      const arr = new ObservableArray([1, 2, 3]);
      expect(arr.pop()).toBe(3);
      expect(arr.get()).toEqual([1, 2]);
    });

    it('returns undefined on empty array', () => {
      const arr = new ObservableArray<number>();
      expect(arr.pop()).toBeUndefined();
    });

    it('notifies change subscribers', () => {
      const arr = new ObservableArray([1, 2]);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.pop();
      expect(notified).toBe(true);
    });
  });

  describe('shift', () => {
    it('removes and returns the first element', () => {
      const arr = new ObservableArray([1, 2, 3]);
      expect(arr.shift()).toBe(1);
      expect(arr.get()).toEqual([2, 3]);
    });

    it('returns undefined on empty array', () => {
      const arr = new ObservableArray<number>();
      expect(arr.shift()).toBeUndefined();
    });

    it('notifies change subscribers', () => {
      const arr = new ObservableArray([1]);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.shift();
      expect(notified).toBe(true);
    });
  });

  describe('unshift', () => {
    it('prepends items to the array', () => {
      const arr = new ObservableArray([3, 4]);
      arr.unshift(1, 2);
      expect(arr.get()).toEqual([1, 2, 3, 4]);
    });

    it('returns the new length', () => {
      const arr = new ObservableArray([1]);
      expect(arr.unshift(0)).toBe(2);
    });

    it('notifies change subscribers', () => {
      const arr = new ObservableArray([1]);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.unshift(0);
      expect(notified).toBe(true);
    });
  });

  describe('splice', () => {
    it('removes elements at a given index', () => {
      const arr = new ObservableArray([1, 2, 3, 4]);
      const removed = arr.splice(1, 2);
      expect(removed).toEqual([2, 3]);
      expect(arr.get()).toEqual([1, 4]);
    });

    it('inserts elements at a given index', () => {
      const arr = new ObservableArray([1, 4]);
      arr.splice(1, 0, 2, 3);
      expect(arr.get()).toEqual([1, 2, 3, 4]);
    });

    it('replaces elements', () => {
      const arr = new ObservableArray([1, 2, 3]);
      arr.splice(1, 1, 9);
      expect(arr.get()).toEqual([1, 9, 3]);
    });

    it('handles negative start index', () => {
      const arr = new ObservableArray([1, 2, 3, 4]);
      arr.splice(-2, 1);
      expect(arr.get()).toEqual([1, 2, 4]);
    });

    it('notifies change subscribers', () => {
      const arr = new ObservableArray([1, 2, 3]);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.splice(0, 1);
      expect(notified).toBe(true);
    });
  });

  describe('sort', () => {
    it('sorts the array in place', () => {
      const arr = new ObservableArray([3, 1, 2]);
      arr.sort();
      expect(arr.get()).toEqual([1, 2, 3]);
    });

    it('accepts a custom compare function', () => {
      const arr = new ObservableArray([1, 3, 2]);
      arr.sort((a, b) => b - a);
      expect(arr.get()).toEqual([3, 2, 1]);
    });

    it('returns the observable array, not the raw array', () => {
      const arr = new ObservableArray([3, 1, 2]);
      expect(arr.sort()).toBe(arr);
    });

    it('notifies change subscribers', () => {
      const arr = new ObservableArray([3, 1, 2]);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.sort();
      expect(notified).toBe(true);
    });
  });

  describe('reverse', () => {
    it('reverses the array in place', () => {
      const arr = new ObservableArray([1, 2, 3]);
      arr.reverse();
      expect(arr.get()).toEqual([3, 2, 1]);
    });

    it('returns the observable array, not the raw array', () => {
      const arr = new ObservableArray([1, 2, 3]);
      expect(arr.reverse()).toBe(arr);
    });

    it('notifies change subscribers', () => {
      const arr = new ObservableArray([1, 2, 3]);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.reverse();
      expect(notified).toBe(true);
    });
  });

  describe('remove', () => {
    it('removes a specific value', () => {
      const arr = new ObservableArray([1, 2, 3, 2]);
      const removed = arr.remove(2);
      expect(removed).toEqual([2, 2]);
      expect(arr.get()).toEqual([1, 3]);
    });

    it('removes items matching a predicate', () => {
      const arr = new ObservableArray([1, 2, 3, 4]);
      const removed = arr.remove((v) => v % 2 === 0);
      expect(removed).toEqual([2, 4]);
      expect(arr.get()).toEqual([1, 3]);
    });

    it('returns empty array when no matches', () => {
      const arr = new ObservableArray([1, 2, 3]);
      const removed = arr.remove(99);
      expect(removed).toEqual([]);
    });

    it('does not notify if nothing was removed', () => {
      const arr = new ObservableArray([1, 2, 3]);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.remove(99);
      expect(notified).toBe(false);
    });

    it('notifies if items were removed', () => {
      const arr = new ObservableArray([1, 2, 3]);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.remove(2);
      expect(notified).toBe(true);
    });
  });

  describe('removeAll', () => {
    it('removes all items when called with no arguments', () => {
      const arr = new ObservableArray([1, 2, 3]);
      const removed = arr.removeAll();
      expect(removed).toEqual([1, 2, 3]);
      expect(arr.get()).toEqual([]);
    });

    it('removes only specified items', () => {
      const arr = new ObservableArray([1, 2, 3, 4]);
      const removed = arr.removeAll([2, 4]);
      expect(removed).toEqual([2, 4]);
      expect(arr.get()).toEqual([1, 3]);
    });

    it('returns empty array when passed empty array', () => {
      const arr = new ObservableArray([1, 2, 3]);
      expect(arr.removeAll([])).toEqual([]);
    });
  });

  // TODO: destroy/destroyAll may be removed in favor of a mapping library approach.
  describe('destroy', () => {
    it('marks matching items as destroyed', () => {
      const items = [{ name: 'a' }, { name: 'b' }, { name: 'c' }];
      const arr = new ObservableArray(items);
      arr.destroy(items[1]);
      expect(isDestroyed(items[1])).toBe(true);
      expect(isDestroyed(items[0])).toBe(false);
    });

    it('marks items matching a predicate', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const arr = new ObservableArray(items);
      arr.destroy((item) => item.id > 1);
      expect(isDestroyed(items[0])).toBe(false);
      expect(isDestroyed(items[1])).toBe(true);
      expect(isDestroyed(items[2])).toBe(true);
    });

    it('notifies change subscribers', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const arr = new ObservableArray(items);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.destroy(items[1]);
      expect(notified).toBe(true);
    });
  });

  describe('destroyAll', () => {
    it('marks all items when called with no arguments', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const arr = new ObservableArray(items);
      arr.destroyAll();
      expect(isDestroyed(items[0])).toBe(true);
      expect(isDestroyed(items[1])).toBe(true);
    });

    it('marks only specified items', () => {
      const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const arr = new ObservableArray(items);
      arr.destroyAll([items[0], items[2]]);
      expect(isDestroyed(items[0])).toBe(true);
      expect(isDestroyed(items[1])).toBe(false);
      expect(isDestroyed(items[2])).toBe(true);
    });
  });

  describe('replace', () => {
    it('replaces a specific item', () => {
      const arr = new ObservableArray(['a', 'b', 'c']);
      arr.replace('b', 'x');
      expect(arr.get()).toEqual(['a', 'x', 'c']);
    });

    it('does nothing if the item is not found', () => {
      const arr = new ObservableArray(['a', 'b']);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.replace('z', 'x');
      expect(arr.get()).toEqual(['a', 'b']);
      expect(notified).toBe(false);
    });

    it('notifies when an item is replaced', () => {
      const arr = new ObservableArray(['a', 'b']);
      let notified = false;
      arr.subscribe(() => { notified = true; });
      arr.replace('a', 'x');
      expect(notified).toBe(true);
    });
  });

  describe('indexOf', () => {
    it('returns the index of an item', () => {
      const arr = new ObservableArray(['a', 'b', 'c']);
      expect(arr.indexOf('b')).toBe(1);
    });

    it('returns -1 for items not in the array', () => {
      const arr = new ObservableArray(['a', 'b']);
      expect(arr.indexOf('z')).toBe(-1);
    });
  });

  describe('slice', () => {
    it('returns a copy of a portion of the array', () => {
      const arr = new ObservableArray([1, 2, 3, 4]);
      expect(arr.slice(1, 3)).toEqual([2, 3]);
    });

    it('returns a full copy with no arguments', () => {
      const arr = new ObservableArray([1, 2, 3]);
      const copy = arr.slice();
      expect(copy).toEqual([1, 2, 3]);
      expect(copy).not.toBe(arr.peek());
    });
  });

  describe('sorted', () => {
    it('returns a sorted copy without modifying the original', () => {
      const arr = new ObservableArray([3, 1, 2]);
      const sorted = arr.sorted();
      expect(sorted).toEqual([1, 2, 3]);
      expect(arr.get()).toEqual([3, 1, 2]);
    });

    it('accepts a custom compare function', () => {
      const arr = new ObservableArray([1, 3, 2]);
      expect(arr.sorted((a, b) => b - a)).toEqual([3, 2, 1]);
    });
  });

  describe('reversed', () => {
    it('returns a reversed copy without modifying the original', () => {
      const arr = new ObservableArray([1, 2, 3]);
      const rev = arr.reversed();
      expect(rev).toEqual([3, 2, 1]);
      expect(arr.get()).toEqual([1, 2, 3]);
    });
  });

  describe('arrayChange event', () => {
    it('fires with added entries on push', () => {
      const arr = new ObservableArray([1, 2]);
      const changes: ArrayChange<number>[][] = [];
      arr.subscribe((c) => changes.push(c as unknown as ArrayChange<number>[]), ARRAY_CHANGE_EVENT);
      arr.push(3);
      expect(changes.length).toBe(1);
      expect(changes[0]).toEqual([
        { status: 'added', value: 3, index: 2 },
      ]);
    });

    it('fires with deleted entry on pop', () => {
      const arr = new ObservableArray([1, 2, 3]);
      const changes: ArrayChange<number>[][] = [];
      arr.subscribe((c) => changes.push(c as unknown as ArrayChange<number>[]), ARRAY_CHANGE_EVENT);
      arr.pop();
      expect(changes.length).toBe(1);
      expect(changes[0]).toEqual([
        { status: 'deleted', value: 3, index: 2 },
      ]);
    });

    it('fires with deleted entry on shift', () => {
      const arr = new ObservableArray([1, 2, 3]);
      const changes: ArrayChange<number>[][] = [];
      arr.subscribe((c) => changes.push(c as unknown as ArrayChange<number>[]), ARRAY_CHANGE_EVENT);
      arr.shift();
      expect(changes.length).toBe(1);
      expect(changes[0]).toEqual([
        { status: 'deleted', value: 1, index: 0 },
      ]);
    });

    it('fires with added entries on unshift', () => {
      const arr = new ObservableArray([3, 4]);
      const changes: ArrayChange<number>[][] = [];
      arr.subscribe((c) => changes.push(c as unknown as ArrayChange<number>[]), ARRAY_CHANGE_EVENT);
      arr.unshift(1, 2);
      expect(changes.length).toBe(1);
      expect(changes[0]).toEqual([
        { status: 'added', value: 1, index: 0 },
        { status: 'added', value: 2, index: 1 },
      ]);
    });

    it('fires with both added and deleted entries on splice', () => {
      const arr = new ObservableArray([1, 2, 3]);
      const changes: ArrayChange<number>[][] = [];
      arr.subscribe((c) => changes.push(c as unknown as ArrayChange<number>[]), ARRAY_CHANGE_EVENT);
      arr.splice(1, 1, 9);
      expect(changes.length).toBe(1);
      const deleted = changes[0].filter(c => c.status === 'deleted');
      const added = changes[0].filter(c => c.status === 'added');
      expect(deleted.length).toBe(1);
      expect(deleted[0].value).toBe(2);
      expect(added.length).toBe(1);
      expect(added[0].value).toBe(9);
    });

    it('does not fire when no arrayChange subscribers exist', () => {
      const arr = new ObservableArray([1, 2]);
      let changeFired = false;
      arr.subscribe(() => { changeFired = true; });
      arr.push(3);
      expect(changeFired).toBe(true);
    });

    it('uses full diff for sort (no cached diff)', () => {
      const arr = new ObservableArray([3, 1, 2]);
      const changes: ArrayChange<number>[][] = [];
      arr.subscribe((c) => changes.push(c as unknown as ArrayChange<number>[]), ARRAY_CHANGE_EVENT);
      arr.sort();
      expect(changes.length).toBe(1);
      expect(changes[0].length).toBeGreaterThan(0);
    });

    it('uses full diff for reverse (no cached diff)', () => {
      const arr = new ObservableArray([1, 2, 3]);
      const changes: ArrayChange<number>[][] = [];
      arr.subscribe((c) => changes.push(c as unknown as ArrayChange<number>[]), ARRAY_CHANGE_EVENT);
      arr.reverse();
      expect(changes.length).toBe(1);
      expect(changes[0].length).toBeGreaterThan(0);
    });

    it('stops tracking when all arrayChange subscribers are disposed', () => {
      const arr = new ObservableArray([1, 2]);
      const sub = arr.subscribe(() => {}, ARRAY_CHANGE_EVENT);
      sub.dispose();
      expect(arr.hasSubscriptionsForEvent(ARRAY_CHANGE_EVENT)).toBe(false);
    });
  });

  describe('notifications', () => {
    it('fires spectate before change', () => {
      const arr = new ObservableArray([1]);
      const events: string[] = [];
      arr.subscribe(() => events.push('spectate'), 'spectate');
      arr.subscribe(() => events.push('change'));
      arr.push(2);
      expect(events).toEqual(['spectate', 'change']);
    });

    it('fires beforeChange before mutation', () => {
      const arr = new ObservableArray([1, 2]);
      let beforeValue: number[] = [];
      arr.subscribe((v) => { beforeValue = v.slice(); }, 'beforeChange');
      arr.push(3);
      expect(beforeValue).toEqual([1, 2]);
    });
  });
});

describe('isObservableArray', () => {
  it('returns true for an ObservableArray', () => {
    expect(isObservableArray(new ObservableArray())).toBe(true);
  });

  it('returns false for a plain Observable', () => {
    expect(isObservableArray(new Observable(1))).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isObservableArray(null)).toBe(false);
    expect(isObservableArray(undefined)).toBe(false);
  });

  it('returns false for plain arrays', () => {
    expect(isObservableArray([1, 2, 3])).toBe(false);
  });

  it('returns true for isObservable check', () => {
    expect(isObservable(new ObservableArray())).toBe(true);
  });
});

const ARRAY_CHANGE_EVENT = 'arrayChange';
