import {
  compareArrays,
  findMovesInArrayComparison,
  type ArrayChange,
} from '#src/compareArrays.js';

describe('compareArrays', () => {
  describe('basic diffing', () => {
    it('returns empty for two empty arrays', () => {
      const result = compareArrays([], []);
      expect(result).toEqual([]);
    });

    it('detects all additions from an empty array', () => {
      const result = compareArrays([], ['a', 'b', 'c'], { sparse: true });
      expect(result).toEqual([
        { status: 'added', value: 'a', index: 0 },
        { status: 'added', value: 'b', index: 1 },
        { status: 'added', value: 'c', index: 2 },
      ]);
    });

    it('detects all deletions to an empty array', () => {
      const result = compareArrays(['a', 'b', 'c'], [], { sparse: true });
      expect(result).toEqual([
        { status: 'deleted', value: 'a', index: 0 },
        { status: 'deleted', value: 'b', index: 1 },
        { status: 'deleted', value: 'c', index: 2 },
      ]);
    });

    it('detects additions at the end', () => {
      const result = compareArrays(['a', 'b'], ['a', 'b', 'c'], { sparse: true });
      expect(result).toEqual([
        { status: 'added', value: 'c', index: 2 },
      ]);
    });

    it('detects deletions from the end', () => {
      const result = compareArrays(['a', 'b', 'c'], ['a', 'b'], { sparse: true });
      expect(result).toEqual([
        { status: 'deleted', value: 'c', index: 2 },
      ]);
    });

    it('detects additions at the beginning', () => {
      const result = compareArrays(['b', 'c'], ['a', 'b', 'c'], { sparse: true });
      expect(result).toEqual([
        { status: 'added', value: 'a', index: 0 },
      ]);
    });

    it('detects deletions from the beginning', () => {
      const result = compareArrays(['a', 'b', 'c'], ['b', 'c'], { sparse: true });
      expect(result).toEqual([
        { status: 'deleted', value: 'a', index: 0 },
      ]);
    });

    it('detects a mix of additions and deletions', () => {
      const result = compareArrays(['a', 'b', 'c'], ['a', 'x', 'c'], { sparse: true });
      expect(result.filter(c => c.status === 'deleted').map(c => c.value)).toEqual(['b']);
      expect(result.filter(c => c.status === 'added').map(c => c.value)).toEqual(['x']);
    });

    it('returns identical arrays as no changes in sparse mode', () => {
      const result = compareArrays(['a', 'b', 'c'], ['a', 'b', 'c'], { sparse: true });
      expect(result).toEqual([]);
    });
  });

  describe('retained entries', () => {
    it('includes retained entries by default (non-sparse)', () => {
      const result = compareArrays(['a', 'b', 'c'], ['a', 'b', 'c']);
      expect(result.length).toBe(3);
      expect(result.every(c => c.status === 'retained')).toBe(true);
    });

    it('interleaves retained with added/deleted', () => {
      const result = compareArrays(['a', 'b'], ['a', 'c']);
      const statuses = result.map(c => c.status);
      expect(statuses).toContain('retained');
      expect(statuses).toContain('added');
      expect(statuses).toContain('deleted');
    });

    it('excludes retained entries when sparse is true', () => {
      const result = compareArrays(['a', 'b', 'c'], ['a', 'x', 'c'], { sparse: true });
      expect(result.filter(c => c.status === 'retained').length).toBe(0);
    });
  });

  describe('move detection', () => {
    it('detects a moved item', () => {
      const result = compareArrays(['a', 'b', 'c'], ['c', 'a', 'b'], { sparse: true });
      const added = result.filter(c => c.status === 'added');
      const deleted = result.filter(c => c.status === 'deleted');
      expect(added.length).toBeGreaterThan(0);
      expect(deleted.length).toBeGreaterThan(0);
      const movedEntries = result.filter(c => c.moved !== undefined);
      expect(movedEntries.length).toBeGreaterThan(0);
    });

    it('marks moved on both the added and deleted entry', () => {
      const result = compareArrays(['a', 'b', 'c'], ['b', 'c', 'a'], { sparse: true });
      const added = result.filter(c => c.status === 'added');
      const deleted = result.filter(c => c.status === 'deleted');
      const addedMoved = added.filter(c => c.moved !== undefined);
      const deletedMoved = deleted.filter(c => c.moved !== undefined);
      expect(addedMoved.length).toBeGreaterThan(0);
      expect(deletedMoved.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('handles single-element arrays', () => {
      expect(compareArrays(['a'], [], { sparse: true })).toEqual([
        { status: 'deleted', value: 'a', index: 0 },
      ]);
      expect(compareArrays([], ['a'], { sparse: true })).toEqual([
        { status: 'added', value: 'a', index: 0 },
      ]);
    });

    it('handles complete replacement', () => {
      const result = compareArrays(['a', 'b'], ['x', 'y'], { sparse: true });
      expect(result.filter(c => c.status === 'deleted').length).toBe(2);
      expect(result.filter(c => c.status === 'added').length).toBe(2);
    });

    it('works with numeric values', () => {
      const result = compareArrays([1, 2, 3], [1, 3], { sparse: true });
      expect(result).toEqual([
        { status: 'deleted', value: 2, index: 1 },
      ]);
    });

    it('works with object references', () => {
      const a = { id: 1 };
      const b = { id: 2 };
      const c = { id: 3 };
      const result = compareArrays([a, b], [a, c], { sparse: true });
      expect(result.filter(r => r.status === 'deleted')[0].value).toBe(b);
      expect(result.filter(r => r.status === 'added')[0].value).toBe(c);
    });

    it('handles large additions', () => {
      const oldArr = ['a'];
      const newArr = ['a', 'b', 'c', 'd', 'e'];
      const result = compareArrays(oldArr, newArr, { sparse: true });
      expect(result.length).toBe(4);
      expect(result.every(c => c.status === 'added')).toBe(true);
    });
  });
});

describe('findMovesInArrayComparison', () => {
  it('marks matching values as moved', () => {
    const left: ArrayChange<string>[] = [
      { status: 'deleted', value: 'a', index: 0 },
    ];
    const right: ArrayChange<string>[] = [
      { status: 'added', value: 'a', index: 2 },
    ];
    findMovesInArrayComparison(left, right);
    expect(left[0].moved).toBe(2);
    expect(right.length).toBe(0);
  });

  it('does not mark non-matching values', () => {
    const left: ArrayChange<string>[] = [
      { status: 'deleted', value: 'a', index: 0 },
    ];
    const right: ArrayChange<string>[] = [
      { status: 'added', value: 'b', index: 2 },
    ];
    findMovesInArrayComparison(left, right);
    expect(left[0].moved).toBeUndefined();
    expect(right.length).toBe(1);
  });

  it('respects the limit on failed compares', () => {
    const left: ArrayChange<string>[] = [
      { status: 'deleted', value: 'x', index: 0 },
      { status: 'deleted', value: 'a', index: 1 },
    ];
    const right: ArrayChange<string>[] = [
      { status: 'added', value: 'y', index: 0 },
      { status: 'added', value: 'z', index: 1 },
      { status: 'added', value: 'a', index: 2 },
    ];
    findMovesInArrayComparison(left, right, 1);
    expect(left[1].moved).toBeUndefined();
  });

  it('handles empty arrays', () => {
    const left: ArrayChange<string>[] = [];
    const right: ArrayChange<string>[] = [];
    findMovesInArrayComparison(left, right);
    expect(left.length).toBe(0);
    expect(right.length).toBe(0);
  });
});
