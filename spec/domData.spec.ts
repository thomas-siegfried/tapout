import { domDataGet, domDataSet, domDataGetOrSet, domDataClear, domDataNextKey } from '#src/domData.js';

describe('domData', () => {

  describe('domDataGet', () => {
    it('returns undefined for a node with no stored data', () => {
      const node = {};
      expect(domDataGet(node, 'key')).toBeUndefined();
    });

    it('returns undefined for an unstored key on a node that has other data', () => {
      const node = {};
      domDataSet(node, 'existing', 123);
      expect(domDataGet(node, 'other')).toBeUndefined();
    });
  });

  describe('domDataSet / domDataGet round-trip', () => {
    it('stores and retrieves a string value', () => {
      const node = {};
      domDataSet(node, 'name', 'hello');
      expect(domDataGet(node, 'name')).toBe('hello');
    });

    it('stores and retrieves a number value', () => {
      const node = {};
      domDataSet(node, 'count', 42);
      expect(domDataGet(node, 'count')).toBe(42);
    });

    it('stores and retrieves an object value', () => {
      const node = {};
      const obj = { a: 1 };
      domDataSet(node, 'data', obj);
      expect(domDataGet(node, 'data')).toBe(obj);
    });

    it('stores and retrieves null', () => {
      const node = {};
      domDataSet(node, 'val', null);
      expect(domDataGet(node, 'val')).toBeNull();
    });

    it('stores and retrieves false', () => {
      const node = {};
      domDataSet(node, 'flag', false);
      expect(domDataGet(node, 'flag')).toBe(false);
    });

    it('stores and retrieves zero', () => {
      const node = {};
      domDataSet(node, 'n', 0);
      expect(domDataGet(node, 'n')).toBe(0);
    });

    it('overwrites an existing value', () => {
      const node = {};
      domDataSet(node, 'key', 'first');
      domDataSet(node, 'key', 'second');
      expect(domDataGet(node, 'key')).toBe('second');
    });
  });

  describe('domDataSet with undefined (removal)', () => {
    it('removes a previously stored key', () => {
      const node = {};
      domDataSet(node, 'key', 'value');
      domDataSet(node, 'key', undefined);
      expect(domDataGet(node, 'key')).toBeUndefined();
    });

    it('does not create storage when setting undefined on a fresh node', () => {
      const node = {};
      domDataSet(node, 'key', undefined);
      expect(domDataClear(node)).toBe(false);
    });

    it('removes only the specified key, leaving others intact', () => {
      const node = {};
      domDataSet(node, 'a', 1);
      domDataSet(node, 'b', 2);
      domDataSet(node, 'a', undefined);
      expect(domDataGet(node, 'a')).toBeUndefined();
      expect(domDataGet(node, 'b')).toBe(2);
    });
  });

  describe('data isolation', () => {
    it('keeps data separate between different nodes', () => {
      const node1 = {};
      const node2 = {};
      domDataSet(node1, 'key', 'from-node1');
      domDataSet(node2, 'key', 'from-node2');
      expect(domDataGet(node1, 'key')).toBe('from-node1');
      expect(domDataGet(node2, 'key')).toBe('from-node2');
    });

    it('keeps different keys separate on the same node', () => {
      const node = {};
      domDataSet(node, 'a', 1);
      domDataSet(node, 'b', 2);
      expect(domDataGet(node, 'a')).toBe(1);
      expect(domDataGet(node, 'b')).toBe(2);
    });
  });

  describe('domDataGetOrSet', () => {
    it('sets and returns the value when key does not exist', () => {
      const node = {};
      const result = domDataGetOrSet(node, 'key', 'default');
      expect(result).toBe('default');
      expect(domDataGet(node, 'key')).toBe('default');
    });

    it('returns the existing value without overwriting', () => {
      const node = {};
      domDataSet(node, 'key', 'original');
      const result = domDataGetOrSet(node, 'key', 'new');
      expect(result).toBe('original');
      expect(domDataGet(node, 'key')).toBe('original');
    });

    it('returns an existing falsy value without overwriting', () => {
      const node = {};
      domDataSet(node, 'key', 0);
      const result = domDataGetOrSet(node, 'key', 99);
      expect(result).toBe(0);
    });

    it('returns an existing null value without overwriting', () => {
      const node = {};
      domDataSet(node, 'key', null);
      const result = domDataGetOrSet(node, 'key', 'fallback');
      expect(result).toBeNull();
    });
  });

  describe('domDataClear', () => {
    it('returns true when data existed', () => {
      const node = {};
      domDataSet(node, 'key', 'value');
      expect(domDataClear(node)).toBe(true);
    });

    it('returns false when no data existed', () => {
      const node = {};
      expect(domDataClear(node)).toBe(false);
    });

    it('removes all data for the node', () => {
      const node = {};
      domDataSet(node, 'a', 1);
      domDataSet(node, 'b', 2);
      domDataClear(node);
      expect(domDataGet(node, 'a')).toBeUndefined();
      expect(domDataGet(node, 'b')).toBeUndefined();
    });

    it('does not affect other nodes', () => {
      const node1 = {};
      const node2 = {};
      domDataSet(node1, 'key', 'val1');
      domDataSet(node2, 'key', 'val2');
      domDataClear(node1);
      expect(domDataGet(node2, 'key')).toBe('val2');
    });
  });

  describe('domDataNextKey', () => {
    it('returns a string', () => {
      expect(typeof domDataNextKey()).toBe('string');
    });

    it('returns unique values on each call', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(domDataNextKey());
      }
      expect(keys.size).toBe(100);
    });
  });
});
