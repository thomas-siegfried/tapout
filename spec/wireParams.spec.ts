import {
  reactive,
  reactiveArray,
  getObservable,
  wireParams,
  Observable,
  ObservableArray,
  Computed,
} from '#src/index.js';

// ---------- wireParams ----------

describe('wireParams', () => {

  describe('with plain values', () => {
    class Child {
      @reactive accessor name: string = '';
      @reactive accessor age: number = 0;
    }

    it('sets @reactive properties from plain values', () => {
      const child = new Child();
      wireParams(child, { name: 'Alice', age: 25 });
      expect(child.name).toBe('Alice');
      expect(child.age).toBe(25);
    });

    it('sets non-decorated properties from plain values', () => {
      const child = new Child() as Child & { extra: string };
      wireParams(child, { extra: 'hello' });
      expect(child.extra).toBe('hello');
    });

    it('skips $raw key', () => {
      const child = new Child();
      wireParams(child, { name: 'Bob', $raw: { something: true } });
      expect(child.name).toBe('Bob');
      expect((child as Record<string, unknown>)['$raw']).toBeUndefined();
    });
  });

  describe('with Computed params (one-way subscription)', () => {
    class Child {
      @reactive accessor label: string = 'default';
    }

    it('sets the initial value from Computed', () => {
      const parentObs = new Observable('Hello');
      const paramComputed = new Computed(() => parentObs.get());
      const child = new Child();

      wireParams(child, { label: paramComputed });
      expect(child.label).toBe('Hello');
    });

    it('updates child property when parent Computed changes', () => {
      const parentObs = new Observable('Hello');
      const paramComputed = new Computed(() => parentObs.get());
      const child = new Child();

      wireParams(child, { label: paramComputed });
      expect(child.label).toBe('Hello');

      parentObs.set('World');
      expect(child.label).toBe('World');
    });

    it('returns subscriptions that can be disposed', () => {
      const parentObs = new Observable('Hello');
      const paramComputed = new Computed(() => parentObs.get());
      const child = new Child();

      const result = wireParams(child, { label: paramComputed });
      expect(result.subscriptions.length).toBe(1);

      result.subscriptions[0].dispose();
      parentObs.set('After dispose');
      expect(child.label).toBe('Hello');
    });

    it('sets Computed value on non-reactive child properties', () => {
      const parentObs = new Observable('Hello');
      const paramComputed = new Computed(() => parentObs.get());
      const child: Record<string, unknown> = {};

      wireParams(child, { label: paramComputed });
      expect(child.label).toBe('Hello');

      parentObs.set('Updated');
      expect(child.label).toBe('Updated');
    });
  });

  describe('with Observable params (two-way shared)', () => {
    class Child {
      @reactive accessor name: string = '';
    }

    it('replaces the child backing Observable with the parent Observable', () => {
      const parentObs = new Observable('Parent value');
      const child = new Child();

      wireParams(child, { name: parentObs });

      expect(child.name).toBe('Parent value');
      expect(getObservable(child, 'name')).toBe(parentObs);
    });

    it('enables two-way data flow — child writes update parent', () => {
      const parentObs = new Observable('initial');
      const child = new Child();

      wireParams(child, { name: parentObs });

      child.name = 'from child';
      expect(parentObs.get()).toBe('from child');
    });

    it('enables two-way data flow — parent writes update child', () => {
      const parentObs = new Observable('initial');
      const child = new Child();

      wireParams(child, { name: parentObs });

      parentObs.set('from parent');
      expect(child.name).toBe('from parent');
    });

    it('falls back to setting value if child property is not reactive', () => {
      const parentObs = new Observable(42);
      const child = { count: 0 };

      wireParams(child, { count: parentObs });
      expect(child.count).toBe(42);
    });
  });

  describe('with ObservableArray params (two-way shared)', () => {
    class Child {
      @reactiveArray accessor items: string[] = [];
    }

    it('replaces the child backing ObservableArray with the parent', () => {
      const parentArr = new ObservableArray(['a', 'b']);
      const child = new Child();

      wireParams(child, { items: parentArr });

      expect(getObservable(child, 'items')).toBe(parentArr);
      const items = child.items as unknown as ObservableArray<string>;
      expect(items.get()).toEqual(['a', 'b']);
    });

    it('enables two-way array mutations', () => {
      const parentArr = new ObservableArray<string>(['x']);
      const child = new Child();

      wireParams(child, { items: parentArr });

      (child.items as unknown as ObservableArray<string>).push('y');
      expect(parentArr.get()).toEqual(['x', 'y']);
    });
  });

  describe('mixed param types', () => {
    class Dashboard {
      @reactive accessor title: string = 'untitled';
      @reactive accessor count: number = 0;
      @reactiveArray accessor tags: string[] = [];
    }

    it('handles a mix of plain, Computed, and Observable params', () => {
      const parentCount = new Observable(10);
      const parentTags = new ObservableArray(['admin']);
      const titleComputed = new Computed(() => 'Dashboard: ' + parentCount.get());

      const child = new Dashboard();
      wireParams(child, {
        title: titleComputed,
        count: parentCount,
        tags: parentTags,
      });

      expect(child.title).toBe('Dashboard: 10');
      expect(child.count).toBe(10);
      expect(getObservable(child, 'count')).toBe(parentCount);
      expect(getObservable(child, 'tags')).toBe(parentTags);

      parentCount.set(20);
      expect(child.title).toBe('Dashboard: 20');
      expect(child.count).toBe(20);
    });
  });
});
