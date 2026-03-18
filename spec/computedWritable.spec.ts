import {
  Computed,
  Observable,
  isWritableObservable,
} from '#src/index.js';

describe('Computed — writable', () => {
  describe('construction', () => {
    it('accepts an options object with read and write', () => {
      const obs = new Observable(1);
      const c = new Computed({
        read: () => obs.get(),
        write: (v: number) => obs.set(v),
      });
      expect(c.get()).toBe(1);
    });

    it('still accepts a plain function for read-only', () => {
      const c = new Computed(() => 42);
      expect(c.get()).toBe(42);
    });
  });

  describe('set', () => {
    it('delegates to the write function', () => {
      const calls: number[] = [];
      const obs = new Observable(1);
      const c = new Computed({
        read: () => obs.get(),
        write: (v: number) => { calls.push(v); obs.set(v); },
      });

      c.set(99);
      expect(calls).toEqual([99]);
    });

    it('throws on a read-only computed', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      expect(() => c.set(2)).toThrowError(/write/i);
    });

    it('propagates changes through the write function', () => {
      const firstName = new Observable('John');
      const lastName = new Observable('Doe');
      const fullName = new Computed({
        read: () => `${firstName.get()} ${lastName.get()}`,
        write: (value: string) => {
          const parts = value.split(' ');
          firstName.set(parts[0]);
          lastName.set(parts[1]);
        },
      });

      expect(fullName.get()).toBe('John Doe');
      fullName.set('Jane Smith');
      expect(firstName.get()).toBe('Jane');
      expect(lastName.get()).toBe('Smith');
      expect(fullName.get()).toBe('Jane Smith');
    });

    it('triggers subscriber notifications after write causes a re-evaluation', () => {
      const obs = new Observable(1);
      const c = new Computed({
        read: () => obs.get() * 2,
        write: (v: number) => obs.set(v),
      });
      const values: number[] = [];
      c.subscribe(v => values.push(v));

      c.set(5);
      expect(values).toEqual([10]);
    });
  });

  describe('hasWriteFunction', () => {
    it('returns true for a writable computed', () => {
      const c = new Computed({
        read: () => 1,
        write: () => {},
      });
      expect(c.hasWriteFunction).toBe(true);
    });

    it('returns false for a read-only computed', () => {
      const obs = new Observable(1);
      const c = new Computed(() => obs.get());
      expect(c.hasWriteFunction).toBe(false);
    });
  });

  describe('dependency tracking still works', () => {
    it('tracks dependencies from the read function', () => {
      const a = new Observable(1);
      const b = new Observable(2);
      const c = new Computed({
        read: () => a.get() + b.get(),
        write: (v: number) => a.set(v),
      });

      expect(c.getDependenciesCount()).toBe(2);
      expect(c.get()).toBe(3);
    });

    it('re-evaluates when a dependency changes', () => {
      const obs = new Observable(1);
      const c = new Computed({
        read: () => obs.get() * 10,
        write: (v: number) => obs.set(v),
      });

      expect(c.get()).toBe(10);
      obs.set(3);
      expect(c.get()).toBe(30);
    });
  });
});

describe('isWritableObservable', () => {
  it('returns true for a plain Observable', () => {
    expect(isWritableObservable(new Observable(1))).toBe(true);
  });

  it('returns true for a writable Computed', () => {
    const c = new Computed({
      read: () => 1,
      write: () => {},
    });
    expect(isWritableObservable(c)).toBe(true);
  });

  it('returns false for a read-only Computed', () => {
    const obs = new Observable(1);
    const c = new Computed(() => obs.get());
    expect(isWritableObservable(c)).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isWritableObservable(null)).toBe(false);
    expect(isWritableObservable(undefined)).toBe(false);
  });

  it('returns false for plain objects', () => {
    expect(isWritableObservable({})).toBe(false);
    expect(isWritableObservable(42)).toBe(false);
  });
});
