import {
  Observable,
  Computed,
  PureComputed,
} from '#src/index.js';
import { ObservableArray } from '#src/observableArray.js';
import { toJS, toJSON, when } from '#src/utils.js';

describe('toJS', () => {
  describe('primitives passthrough', () => {
    it('returns numbers unchanged', () => {
      expect(toJS(42)).toBe(42);
    });

    it('returns strings unchanged', () => {
      expect(toJS('hello')).toBe('hello');
    });

    it('returns booleans unchanged', () => {
      expect(toJS(true)).toBe(true);
    });

    it('returns null unchanged', () => {
      expect(toJS(null)).toBe(null);
    });

    it('returns undefined unchanged', () => {
      expect(toJS(undefined)).toBeUndefined();
    });
  });

  describe('unwrapping observables', () => {
    it('unwraps a plain Observable', () => {
      const obs = new Observable(42);
      expect(toJS(obs)).toBe(42);
    });

    it('unwraps a Computed', () => {
      const comp = new Computed(() => 99);
      expect(toJS(comp)).toBe(99);
    });

    it('unwraps a PureComputed', () => {
      const comp = new PureComputed(() => 'abc');
      expect(toJS(comp)).toBe('abc');
    });

    it('unwraps nested observables (observable of observable)', () => {
      const inner = new Observable(10);
      const outer = new Observable(inner);
      expect(toJS(outer)).toBe(10);
    });

    it('unwraps an ObservableArray to a plain array', () => {
      const arr = new ObservableArray([1, 2, 3]);
      const result = toJS(arr);
      expect(result).toEqual([1, 2, 3]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('objects with observable properties', () => {
    it('unwraps observable properties on a plain object', () => {
      const obj = {
        name: new Observable('Alice'),
        age: new Observable(30),
      };
      expect(toJS(obj)).toEqual({ name: 'Alice', age: 30 });
    });

    it('unwraps nested objects with observable properties', () => {
      const obj = {
        user: {
          name: new Observable('Bob'),
          address: {
            city: new Observable('NYC'),
          },
        },
      };
      const result = toJS(obj) as { user: { name: string; address: { city: string } } };
      expect(result.user.name).toBe('Bob');
      expect(result.user.address.city).toBe('NYC');
    });

    it('preserves non-observable properties', () => {
      const obj = { x: 1, y: 'hello', z: true };
      expect(toJS(obj)).toEqual({ x: 1, y: 'hello', z: true });
    });
  });

  describe('arrays', () => {
    it('unwraps observables inside arrays', () => {
      const arr = [new Observable(1), new Observable(2), new Observable(3)];
      expect(toJS(arr)).toEqual([1, 2, 3]);
    });

    it('preserves array structure', () => {
      const arr = [1, 'two', true];
      const result = toJS(arr);
      expect(result).toEqual([1, 'two', true]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('handles arrays of objects with observables', () => {
      const arr = [
        { name: new Observable('A') },
        { name: new Observable('B') },
      ];
      expect(toJS(arr)).toEqual([{ name: 'A' }, { name: 'B' }]);
    });

    it('unwraps ObservableArray containing observables', () => {
      const arr = new ObservableArray([new Observable(10), new Observable(20)]);
      expect(toJS(arr)).toEqual([10, 20]);
    });
  });

  describe('special object types passthrough', () => {
    it('passes Date objects through unchanged', () => {
      const date = new Date(2025, 0, 1);
      expect(toJS(date)).toBe(date);
    });

    it('passes RegExp objects through unchanged', () => {
      const regex = /abc/g;
      expect(toJS(regex)).toBe(regex);
    });
  });

  describe('circular references', () => {
    it('handles circular object references', () => {
      const obj: Record<string, unknown> = { name: new Observable('root') };
      obj['self'] = obj;
      const result = toJS(obj) as Record<string, unknown>;
      expect(result['name']).toBe('root');
      expect(result['self']).toBe(result);
    });

    it('handles circular array references', () => {
      const arr: unknown[] = [new Observable(1)];
      arr.push(arr);
      const result = toJS(arr) as unknown[];
      expect(result[0]).toBe(1);
      expect(result[1]).toBe(result);
    });
  });

  describe('mixed complex structures', () => {
    it('handles a realistic view model', () => {
      const vm = {
        firstName: new Observable('John'),
        lastName: new Observable('Doe'),
        fullName: new Computed(() => 'John Doe'),
        tags: new ObservableArray(['a', 'b']),
        address: {
          street: new Observable('123 Main St'),
          zip: '12345',
        },
      };
      const result = toJS(vm) as Record<string, unknown>;
      expect(result['firstName']).toBe('John');
      expect(result['lastName']).toBe('Doe');
      expect(result['fullName']).toBe('John Doe');
      expect(result['tags']).toEqual(['a', 'b']);
      expect((result['address'] as Record<string, unknown>)['street']).toBe('123 Main St');
      expect((result['address'] as Record<string, unknown>)['zip']).toBe('12345');
    });
  });
});

describe('toJSON', () => {
  it('produces a valid JSON string', () => {
    const obj = { name: new Observable('Alice'), age: new Observable(30) };
    const json = toJSON(obj);
    expect(JSON.parse(json)).toEqual({ name: 'Alice', age: 30 });
  });

  it('supports a replacer function', () => {
    const obj = { a: new Observable(1), b: new Observable(2) };
    const json = toJSON(obj, (key, value) => (key === 'a' ? undefined : value));
    expect(JSON.parse(json)).toEqual({ b: 2 });
  });

  it('supports a space argument', () => {
    const obj = { x: new Observable(1) };
    const json = toJSON(obj, undefined, 2);
    expect(json).toContain('\n');
    expect(JSON.parse(json)).toEqual({ x: 1 });
  });

  it('handles primitives', () => {
    expect(toJSON(new Observable(42))).toBe('42');
    expect(toJSON(new Observable('hello'))).toBe('"hello"');
  });
});

describe('when', () => {
  describe('with callback', () => {
    it('calls callback immediately when predicate is already truthy', () => {
      const obs = new Observable(5);
      let resolved: unknown;
      when(() => obs.get(), (value) => { resolved = value; });
      expect(resolved).toBe(5);
    });

    it('calls callback when predicate becomes truthy', () => {
      const obs = new Observable(0);
      let resolved: unknown;
      when(() => obs.get(), (value) => { resolved = value; });
      expect(resolved).toBeUndefined();

      obs.set(42);
      expect(resolved).toBe(42);
    });

    it('only calls callback once (one-shot)', () => {
      const obs = new Observable(0);
      let callCount = 0;
      when(() => obs.get(), () => { callCount++; });

      obs.set(1);
      obs.set(0);
      obs.set(2);
      expect(callCount).toBe(1);
    });

    it('returns a Subscription', () => {
      const obs = new Observable(0);
      const result = when(() => obs.get(), () => {});
      expect(result).toBeDefined();
      expect(typeof (result as { dispose: () => void }).dispose).toBe('function');
    });

    it('does not resolve for falsy values', () => {
      const obs = new Observable<unknown>(0);
      let resolved = false;
      when(() => obs.get(), () => { resolved = true; });

      obs.set('');
      obs.set(null);
      obs.set(false);
      expect(resolved).toBe(false);
    });
  });

  describe('with Promise', () => {
    it('returns a Promise when no callback is provided', () => {
      const obs = new Observable(0);
      const result = when(() => obs.get());
      expect(result instanceof Promise).toBe(true);
    });

    it('resolves when predicate becomes truthy', async () => {
      const obs = new Observable(0);
      const promise = when(() => obs.get()) as Promise<unknown>;

      obs.set(99);

      const value = await promise;
      expect(value).toBe(99);
    });

    it('resolves immediately when predicate is already truthy', async () => {
      const obs = new Observable(10);
      const value = await (when(() => obs.get()) as Promise<unknown>);
      expect(value).toBe(10);
    });
  });

  describe('disposal', () => {
    it('can be cancelled by disposing the returned subscription', () => {
      const obs = new Observable(0);
      let resolved = false;
      const sub = when(() => obs.get(), () => { resolved = true; });
      (sub as { dispose: () => void }).dispose();

      obs.set(1);
      expect(resolved).toBe(false);
    });
  });
});
