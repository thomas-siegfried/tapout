import {
  reactive,
  reactiveArray,
  computed,
  getObservable,
  replaceObservable,
  Observable,
  ObservableArray,
  Computed,
  Subscribable,
  begin,
  end,
} from '#src/index.js';

// ---------- @reactive ----------

describe('@reactive', () => {
  class Person {
    @reactive accessor age: number = 21;
    @reactive accessor name: string = 'Alice';
  }

  it('stores and returns the initial value', () => {
    const p = new Person();
    expect(p.age).toBe(21);
    expect(p.name).toBe('Alice');
  });

  it('updates value via assignment', () => {
    const p = new Person();
    p.age = 30;
    expect(p.age).toBe(30);
  });

  it('triggers subscriptions on change', () => {
    const p = new Person();
    const obs = getObservable(p, 'age')!;
    const values: number[] = [];
    obs.subscribe((v: number) => values.push(v));

    p.age = 25;
    p.age = 30;
    expect(values).toEqual([25, 30]);
  });

  it('does not notify when set to the same primitive value', () => {
    const p = new Person();
    const obs = getObservable(p, 'age')!;
    const spy = jasmine.createSpy('sub');
    obs.subscribe(spy);

    p.age = 21;
    expect(spy).not.toHaveBeenCalled();
  });

  it('registers dependency inside a tracking frame', () => {
    const p = new Person();
    const deps: Subscribable[] = [];
    begin({
      callback: (sub) => deps.push(sub),
    });
    try {
      void p.age;
    } finally {
      end();
    }
    expect(deps.length).toBe(1);
    expect(deps[0]).toBe(getObservable(p, 'age')!);
  });

  it('provides separate observables per instance', () => {
    const p1 = new Person();
    const p2 = new Person();
    p1.age = 99;
    expect(p2.age).toBe(21);
    expect(getObservable(p1, 'age')).not.toBe(getObservable(p2, 'age'));
  });

  describe('with extender options', () => {
    class ExtendedModel {
      @reactive({ notify: 'always' }) accessor tag: string = '';
    }

    it('applies extenders at creation time', () => {
      const m = new ExtendedModel();
      const spy = jasmine.createSpy('sub');
      const obs = getObservable(m, 'tag')!;
      obs.subscribe(spy);

      m.tag = '';
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------- @reactiveArray ----------

describe('@reactiveArray', () => {
  class TodoList {
    @reactiveArray accessor items: string[] = ['a', 'b'];
  }

  it('stores the initial array values', () => {
    const list = new TodoList();
    expect(list.items).toBeInstanceOf(ObservableArray);
    expect((list.items as unknown as ObservableArray<string>).get()).toEqual(['a', 'b']);
  });

  it('supports push and notifies', () => {
    const list = new TodoList();
    const obs = getObservable(list, 'items') as ObservableArray<string>;
    const spy = jasmine.createSpy('sub');
    obs.subscribe(spy);

    (list.items as unknown as ObservableArray<string>).push('c');
    expect(spy).toHaveBeenCalled();
    expect((list.items as unknown as ObservableArray<string>).get()).toEqual(['a', 'b', 'c']);
  });

  it('accepts plain array assignment via setter', () => {
    const list = new TodoList();
    const obs = getObservable(list, 'items') as ObservableArray<string>;
    const spy = jasmine.createSpy('sub');
    obs.subscribe(spy);

    list.items = ['x', 'y'] as unknown as string[];
    expect(spy).toHaveBeenCalled();
    expect((list.items as unknown as ObservableArray<string>).get()).toEqual(['x', 'y']);
  });

  it('preserves the same ObservableArray instance on reassignment', () => {
    const list = new TodoList();
    const obsBefore = getObservable(list, 'items');
    list.items = ['new'] as unknown as string[];
    const obsAfter = getObservable(list, 'items');
    expect(obsBefore).toBe(obsAfter);
  });

  it('registers dependency when read', () => {
    const list = new TodoList();
    const deps: Subscribable[] = [];
    begin({
      callback: (sub) => deps.push(sub),
    });
    try {
      void list.items;
    } finally {
      end();
    }
    expect(deps.length).toBe(1);
  });

  it('supports iteration via Symbol.iterator', () => {
    const list = new TodoList();
    const result = [...(list.items as unknown as ObservableArray<string>)];
    expect(result).toEqual(['a', 'b']);
  });

  it('exposes length', () => {
    const list = new TodoList();
    expect((list.items as unknown as ObservableArray<string>).length).toBe(2);
  });

  it('supports map, filter, find', () => {
    const list = new TodoList();
    const items = list.items as unknown as ObservableArray<string>;
    expect(items.map(s => s.toUpperCase())).toEqual(['A', 'B']);
    expect(items.filter(s => s === 'a')).toEqual(['a']);
    expect(items.find(s => s === 'b')).toBe('b');
  });

  describe('with extender options', () => {
    class RateLimitedList {
      @reactiveArray({ notify: 'always' }) accessor tags: string[] = [];
    }

    it('applies extenders', () => {
      const m = new RateLimitedList();
      const obs = getObservable(m, 'tags') as ObservableArray<string>;
      const spy = jasmine.createSpy('sub');
      obs.subscribe(spy);

      m.tags = [] as unknown as string[];
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

// ---------- @computed (getter) ----------

describe('@computed on getter', () => {
  class FullName {
    @reactive accessor first: string = 'John';
    @reactive accessor last: string = 'Doe';

    @computed
    get full() {
      return `${this.first} ${this.last}`;
    }
  }

  it('computes the initial value lazily', () => {
    const f = new FullName();
    expect(f.full).toBe('John Doe');
  });

  it('re-evaluates when a dependency changes', () => {
    const f = new FullName();
    f.first = 'Jane';
    expect(f.full).toBe('Jane Doe');
  });

  it('is observable via getObservable', () => {
    const f = new FullName();
    void f.full;
    const comp = getObservable(f, 'full');
    expect(comp).toBeInstanceOf(Computed);
  });

  it('notifies subscribers when dependencies change', () => {
    const f = new FullName();
    void f.full;
    const comp = getObservable(f, 'full')!;
    const values: string[] = [];
    comp.subscribe((v: string) => values.push(v));

    f.first = 'Bob';
    expect(values).toEqual(['Bob Doe']);
  });

  it('provides separate computed per instance', () => {
    const f1 = new FullName();
    const f2 = new FullName();
    f1.first = 'A';
    expect(f1.full).toBe('A Doe');
    expect(f2.full).toBe('John Doe');
  });
});

// ---------- @computed (getter + setter) ----------

describe('@computed on getter with setter', () => {
  class WritableComputed {
    @reactive accessor first: string = 'John';
    @reactive accessor last: string = 'Doe';

    @computed
    get full() {
      return `${this.first} ${this.last}`;
    }

    set full(v: string) {
      const parts = v.split(' ');
      this.first = parts[0] ?? '';
      this.last = parts[1] ?? '';
    }
  }

  it('reads computed value', () => {
    const w = new WritableComputed();
    expect(w.full).toBe('John Doe');
  });

  it('setter updates dependencies which re-evaluates computed', () => {
    const w = new WritableComputed();
    w.full = 'Jane Smith';
    expect(w.first).toBe('Jane');
    expect(w.last).toBe('Smith');
    expect(w.full).toBe('Jane Smith');
  });

  it('notifies computed subscribers when setter is used', () => {
    const w = new WritableComputed();
    void w.full;
    const comp = getObservable(w, 'full')!;
    const values: string[] = [];
    comp.subscribe((v: string) => values.push(v));

    w.full = 'Bob Jones';
    expect(values).toContain('Bob Jones');
  });
});

// ---------- @computed (method) ----------

describe('@computed on method', () => {
  class Calculator {
    @reactive accessor x: number = 2;
    @reactive accessor y: number = 3;

    @computed
    sum() {
      return this.x + this.y;
    }
  }

  it('returns computed value when called', () => {
    const c = new Calculator();
    expect(c.sum()).toBe(5);
  });

  it('re-evaluates when dependencies change', () => {
    const c = new Calculator();
    c.x = 10;
    expect(c.sum()).toBe(13);
  });

  it('caches the computed across calls', () => {
    const c = new Calculator();
    void c.sum();
    const comp1 = getObservable(c, 'sum');
    void c.sum();
    const comp2 = getObservable(c, 'sum');
    expect(comp1).toBe(comp2);
  });

  it('notifies subscribers', () => {
    const c = new Calculator();
    void c.sum();
    const comp = getObservable(c, 'sum')!;
    const values: number[] = [];
    comp.subscribe((v: number) => values.push(v));

    c.x = 100;
    expect(values).toEqual([103]);
  });
});

// ---------- getObservable ----------

describe('getObservable', () => {
  class Model {
    @reactive accessor value: number = 1;
    @reactiveArray accessor list: string[] = [];

    @computed
    get doubled() {
      return this.value * 2;
    }
  }

  it('returns Observable for @reactive properties', () => {
    const m = new Model();
    const obs = getObservable(m, 'value');
    expect(obs).toBeInstanceOf(Observable);
  });

  it('returns ObservableArray for @reactiveArray properties', () => {
    const m = new Model();
    const obs = getObservable(m, 'list');
    expect(obs).toBeInstanceOf(ObservableArray);
  });

  it('returns Computed for @computed properties', () => {
    const m = new Model();
    void m.doubled;
    const obs = getObservable(m, 'doubled');
    expect(obs).toBeInstanceOf(Computed);
  });

  it('returns undefined for non-decorated properties', () => {
    const m = new Model();
    const obs = getObservable(m, 'nonExistent');
    expect(obs).toBeUndefined();
  });
});

// ---------- Interaction tests ----------

describe('decorator interactions', () => {
  class ViewModel {
    @reactive accessor firstName: string = 'John';
    @reactive accessor lastName: string = 'Doe';
    @reactiveArray accessor tags: string[] = ['admin'];

    @computed
    get displayName() {
      return `${this.firstName} ${this.lastName}`;
    }

    @computed
    tagCount() {
      return (this.tags as unknown as ObservableArray<string>).length;
    }
  }

  it('computed reacts to reactive property changes', () => {
    const vm = new ViewModel();
    expect(vm.displayName).toBe('John Doe');

    vm.firstName = 'Jane';
    expect(vm.displayName).toBe('Jane Doe');
  });

  it('computed method reacts to array mutations', () => {
    const vm = new ViewModel();
    expect(vm.tagCount()).toBe(1);

    (vm.tags as unknown as ObservableArray<string>).push('user');
    expect(vm.tagCount()).toBe(2);
  });

  it('computed notifies when underlying reactive changes', () => {
    const vm = new ViewModel();
    void vm.displayName;
    const comp = getObservable(vm, 'displayName')!;
    const spy = jasmine.createSpy('display');
    comp.subscribe(spy);

    vm.lastName = 'Smith';
    expect(spy).toHaveBeenCalledWith('John Smith');
  });
});

// ==========================================================================
// Legacy decorator tests
//
// These test the legacy (experimentalDecorators) code path by calling the
// decorator functions directly the way the legacy transform would, rather
// than using decorator syntax (which our tsconfig compiles as Stage 3).
// ==========================================================================

describe('legacy @reactive', () => {
  function createPersonClass() {
    class Person {}
    // Simulate legacy decorator application on the prototype
    (reactive as Function)(Person.prototype, 'name');
    (reactive as Function)(Person.prototype, 'age');
    return Person;
  }

  it('stores and returns values set after construction', () => {
    const Person = createPersonClass();
    const p = new Person() as Record<string, unknown>;
    p.name = 'Alice';
    p.age = 21;
    expect(p.name).toBe('Alice');
    expect(p.age).toBe(21);
  });

  it('creates an Observable accessible via getObservable', () => {
    const Person = createPersonClass();
    const p = new Person() as Record<string, unknown>;
    p.name = 'Alice';
    const obs = getObservable(p, 'name');
    expect(obs).toBeInstanceOf(Observable);
  });

  it('triggers subscriptions on change', () => {
    const Person = createPersonClass();
    const p = new Person() as Record<string, unknown>;
    p.name = 'Alice';
    const obs = getObservable(p, 'name')!;
    const values: unknown[] = [];
    obs.subscribe((v: unknown) => values.push(v));

    p.name = 'Bob';
    p.name = 'Charlie';
    expect(values).toEqual(['Bob', 'Charlie']);
  });

  it('does not notify when set to the same primitive value', () => {
    const Person = createPersonClass();
    const p = new Person() as Record<string, unknown>;
    p.age = 21;
    const obs = getObservable(p, 'age')!;
    const spy = jasmine.createSpy('sub');
    obs.subscribe(spy);

    p.age = 21;
    expect(spy).not.toHaveBeenCalled();
  });

  it('provides separate observables per instance', () => {
    const Person = createPersonClass();
    const p1 = new Person() as Record<string, unknown>;
    const p2 = new Person() as Record<string, unknown>;
    p1.name = 'Alice';
    p2.name = 'Bob';
    expect(p1.name).toBe('Alice');
    expect(p2.name).toBe('Bob');
    expect(getObservable(p1, 'name')).not.toBe(getObservable(p2, 'name'));
  });

  it('registers dependency inside a tracking frame', () => {
    const Person = createPersonClass();
    const p = new Person() as Record<string, unknown>;
    p.name = 'Alice';
    const deps: Subscribable[] = [];
    begin({ callback: (sub) => deps.push(sub) });
    try {
      void p.name;
    } finally {
      end();
    }
    expect(deps.length).toBe(1);
    expect(deps[0]).toBe(getObservable(p, 'name')!);
  });

  it('creates Observable with undefined if read before first set', () => {
    const Person = createPersonClass();
    const p = new Person() as Record<string, unknown>;
    expect(p.name).toBeUndefined();
    const obs = getObservable(p, 'name');
    expect(obs).toBeInstanceOf(Observable);
  });

  describe('with extender options', () => {
    it('applies extenders at creation time', () => {
      class Model {}
      const decorator = (reactive as Function)({ notify: 'always' });
      decorator(Model.prototype, 'tag');

      const m = new Model() as Record<string, unknown>;
      m.tag = '';
      const obs = getObservable(m, 'tag')!;
      const spy = jasmine.createSpy('sub');
      obs.subscribe(spy);

      m.tag = '';
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('with Babel initializer descriptor', () => {
    function createPersonWithInitializer() {
      class Person {}
      const desc = (reactive as Function)(Person.prototype, 'name', {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer() { return 'Alice'; },
      });
      Object.defineProperty(Person.prototype, 'name', desc);
      return Person;
    }

    it('uses initializer for initial value on first read', () => {
      const Person = createPersonWithInitializer();
      const p = new Person() as Record<string, unknown>;
      expect(p.name).toBe('Alice');
    });

    it('creates an Observable with the initialized value', () => {
      const Person = createPersonWithInitializer();
      const p = new Person() as Record<string, unknown>;
      void p.name;
      const obs = getObservable(p, 'name');
      expect(obs).toBeInstanceOf(Observable);
      expect((obs as Observable<string>).get()).toBe('Alice');
    });

    it('does not define property on target during decoration', () => {
      class Person {}
      (reactive as Function)(Person.prototype, 'name', {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer() { return 'Alice'; },
      });
      const own = Object.getOwnPropertyDescriptor(Person.prototype, 'name');
      expect(own).toBeUndefined();
    });

    it('returns a descriptor with get and set', () => {
      class Person {}
      const desc = (reactive as Function)(Person.prototype, 'name', {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer() { return 'Alice'; },
      });
      expect(typeof desc.get).toBe('function');
      expect(typeof desc.set).toBe('function');
    });

    it('setter works after initialization', () => {
      const Person = createPersonWithInitializer();
      const p = new Person() as Record<string, unknown>;
      expect(p.name).toBe('Alice');
      p.name = 'Bob';
      expect(p.name).toBe('Bob');
    });

    it('triggers subscriptions on change', () => {
      const Person = createPersonWithInitializer();
      const p = new Person() as Record<string, unknown>;
      void p.name;
      const obs = getObservable(p, 'name')!;
      const values: unknown[] = [];
      obs.subscribe((v: unknown) => values.push(v));

      p.name = 'Bob';
      expect(values).toEqual(['Bob']);
    });

    it('provides separate observables per instance', () => {
      const Person = createPersonWithInitializer();
      const p1 = new Person() as Record<string, unknown>;
      const p2 = new Person() as Record<string, unknown>;
      p1.name = 'X';
      expect(p2.name).toBe('Alice');
      expect(getObservable(p1, 'name')).not.toBe(getObservable(p2, 'name'));
    });

    it('applies extenders with initializer', () => {
      class Model {}
      const decorator = (reactive as Function)({ notify: 'always' });
      const desc = decorator(Model.prototype, 'tag', {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer() { return ''; },
      });
      Object.defineProperty(Model.prototype, 'tag', desc);

      const m = new Model() as Record<string, unknown>;
      void m.tag;
      const obs = getObservable(m, 'tag')!;
      const spy = jasmine.createSpy('sub');
      obs.subscribe(spy);

      m.tag = '';
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('legacy @reactiveArray', () => {
  function createListClass() {
    class TodoList {}
    (reactiveArray as Function)(TodoList.prototype, 'items');
    return TodoList;
  }

  it('creates ObservableArray on first set', () => {
    const TodoList = createListClass();
    const list = new TodoList() as Record<string, unknown>;
    list.items = ['a', 'b'];
    expect(list.items).toBeInstanceOf(ObservableArray);
    expect((list.items as ObservableArray<string>).get()).toEqual(['a', 'b']);
  });

  it('creates empty ObservableArray on first read (no set)', () => {
    const TodoList = createListClass();
    const list = new TodoList() as Record<string, unknown>;
    expect(list.items).toBeInstanceOf(ObservableArray);
    expect((list.items as ObservableArray<unknown>).get()).toEqual([]);
  });

  it('supports push and notifies', () => {
    const TodoList = createListClass();
    const list = new TodoList() as Record<string, unknown>;
    list.items = ['a', 'b'];
    const obs = getObservable(list, 'items') as ObservableArray<string>;
    const spy = jasmine.createSpy('sub');
    obs.subscribe(spy);

    (list.items as ObservableArray<string>).push('c');
    expect(spy).toHaveBeenCalled();
    expect(obs.get()).toEqual(['a', 'b', 'c']);
  });

  it('accepts plain array assignment via setter', () => {
    const TodoList = createListClass();
    const list = new TodoList() as Record<string, unknown>;
    list.items = ['a', 'b'];
    const obs = getObservable(list, 'items') as ObservableArray<string>;
    const spy = jasmine.createSpy('sub');
    obs.subscribe(spy);

    list.items = ['x', 'y'];
    expect(spy).toHaveBeenCalled();
    expect(obs.get()).toEqual(['x', 'y']);
  });

  it('preserves the same ObservableArray instance on reassignment', () => {
    const TodoList = createListClass();
    const list = new TodoList() as Record<string, unknown>;
    list.items = ['a'];
    const obsBefore = getObservable(list, 'items');
    list.items = ['b'];
    const obsAfter = getObservable(list, 'items');
    expect(obsBefore).toBe(obsAfter);
  });

  it('registers dependency when read', () => {
    const TodoList = createListClass();
    const list = new TodoList() as Record<string, unknown>;
    list.items = ['a'];
    const deps: Subscribable[] = [];
    begin({ callback: (sub) => deps.push(sub) });
    try {
      void list.items;
    } finally {
      end();
    }
    expect(deps.length).toBe(1);
  });

  describe('with extender options', () => {
    it('applies extenders', () => {
      class Model {}
      const decorator = (reactiveArray as Function)({ notify: 'always' });
      decorator(Model.prototype, 'tags');

      const m = new Model() as Record<string, unknown>;
      m.tags = [];
      const obs = getObservable(m, 'tags') as ObservableArray<string>;
      const spy = jasmine.createSpy('sub');
      obs.subscribe(spy);

      m.tags = [];
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('with Babel initializer descriptor', () => {
    function createListWithInitializer() {
      class TodoList {}
      const desc = (reactiveArray as Function)(TodoList.prototype, 'items', {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer() { return ['a', 'b']; },
      });
      Object.defineProperty(TodoList.prototype, 'items', desc);
      return TodoList;
    }

    it('uses initializer for initial array value on first read', () => {
      const TodoList = createListWithInitializer();
      const list = new TodoList() as Record<string, unknown>;
      expect(list.items).toBeInstanceOf(ObservableArray);
      expect((list.items as ObservableArray<string>).get()).toEqual(['a', 'b']);
    });

    it('does not define property on target during decoration', () => {
      class TodoList {}
      (reactiveArray as Function)(TodoList.prototype, 'items', {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer() { return ['a']; },
      });
      const own = Object.getOwnPropertyDescriptor(TodoList.prototype, 'items');
      expect(own).toBeUndefined();
    });

    it('returns a descriptor with get and set', () => {
      class TodoList {}
      const desc = (reactiveArray as Function)(TodoList.prototype, 'items', {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer() { return ['a']; },
      });
      expect(typeof desc.get).toBe('function');
      expect(typeof desc.set).toBe('function');
    });

    it('supports push and notifies', () => {
      const TodoList = createListWithInitializer();
      const list = new TodoList() as Record<string, unknown>;
      void list.items;
      const obs = getObservable(list, 'items') as ObservableArray<string>;
      const spy = jasmine.createSpy('sub');
      obs.subscribe(spy);

      (list.items as ObservableArray<string>).push('c');
      expect(spy).toHaveBeenCalled();
      expect(obs.get()).toEqual(['a', 'b', 'c']);
    });

    it('accepts plain array assignment via setter', () => {
      const TodoList = createListWithInitializer();
      const list = new TodoList() as Record<string, unknown>;
      void list.items;
      const obs = getObservable(list, 'items') as ObservableArray<string>;
      const spy = jasmine.createSpy('sub');
      obs.subscribe(spy);

      list.items = ['x', 'y'];
      expect(spy).toHaveBeenCalled();
      expect(obs.get()).toEqual(['x', 'y']);
    });

    it('provides separate arrays per instance', () => {
      const TodoList = createListWithInitializer();
      const l1 = new TodoList() as Record<string, unknown>;
      const l2 = new TodoList() as Record<string, unknown>;
      (l1.items as ObservableArray<string>).push('x');
      expect((l2.items as ObservableArray<string>).get()).toEqual(['a', 'b']);
    });

    it('applies extenders with initializer', () => {
      class Model {}
      const decorator = (reactiveArray as Function)({ notify: 'always' });
      const desc = decorator(Model.prototype, 'tags', {
        configurable: true,
        enumerable: true,
        writable: true,
        initializer() { return []; },
      });
      Object.defineProperty(Model.prototype, 'tags', desc);

      const m = new Model() as Record<string, unknown>;
      void m.tags;
      const obs = getObservable(m, 'tags') as ObservableArray<string>;
      const spy = jasmine.createSpy('sub');
      obs.subscribe(spy);

      m.tags = [];
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('legacy @computed', () => {
  describe('on getter', () => {
    function createFullNameClass() {
      class FullName {}
      (reactive as Function)(FullName.prototype, 'first');
      (reactive as Function)(FullName.prototype, 'last');

      const getterDesc = {
        get(this: Record<string, unknown>) {
          return `${this.first} ${this.last}`;
        },
        configurable: true,
        enumerable: true,
      };
      const result = (computed as Function)(FullName.prototype, 'full', getterDesc);
      Object.defineProperty(FullName.prototype, 'full', result || getterDesc);
      return FullName;
    }

    it('computes the value', () => {
      const FullName = createFullNameClass();
      const f = new FullName() as Record<string, unknown>;
      f.first = 'John';
      f.last = 'Doe';
      expect(f.full).toBe('John Doe');
    });

    it('re-evaluates when a dependency changes', () => {
      const FullName = createFullNameClass();
      const f = new FullName() as Record<string, unknown>;
      f.first = 'John';
      f.last = 'Doe';
      expect(f.full).toBe('John Doe');
      f.first = 'Jane';
      expect(f.full).toBe('Jane Doe');
    });

    it('is observable via getObservable', () => {
      const FullName = createFullNameClass();
      const f = new FullName() as Record<string, unknown>;
      f.first = 'John';
      f.last = 'Doe';
      void f.full;
      const comp = getObservable(f, 'full');
      expect(comp).toBeInstanceOf(Computed);
    });

    it('notifies subscribers when dependencies change', () => {
      const FullName = createFullNameClass();
      const f = new FullName() as Record<string, unknown>;
      f.first = 'John';
      f.last = 'Doe';
      void f.full;
      const comp = getObservable(f, 'full')!;
      const values: string[] = [];
      comp.subscribe((v: string) => values.push(v));

      f.first = 'Bob';
      expect(values).toEqual(['Bob Doe']);
    });
  });

  describe('on getter with setter', () => {
    function createWritableClass() {
      class Writable {}
      (reactive as Function)(Writable.prototype, 'first');
      (reactive as Function)(Writable.prototype, 'last');

      const desc = {
        get(this: Record<string, unknown>) {
          return `${this.first} ${this.last}`;
        },
        set(this: Record<string, unknown>, v: string) {
          const parts = v.split(' ');
          this.first = parts[0] ?? '';
          this.last = parts[1] ?? '';
        },
        configurable: true,
        enumerable: true,
      };
      const result = (computed as Function)(Writable.prototype, 'full', desc);
      Object.defineProperty(Writable.prototype, 'full', result || desc);
      return Writable;
    }

    it('reads computed value', () => {
      const Writable = createWritableClass();
      const w = new Writable() as Record<string, unknown>;
      w.first = 'John';
      w.last = 'Doe';
      expect(w.full).toBe('John Doe');
    });

    it('setter updates dependencies which re-evaluates computed', () => {
      const Writable = createWritableClass();
      const w = new Writable() as Record<string, unknown>;
      w.first = 'John';
      w.last = 'Doe';
      w.full = 'Jane Smith';
      expect(w.first).toBe('Jane');
      expect(w.last).toBe('Smith');
      expect(w.full).toBe('Jane Smith');
    });
  });

  describe('on method', () => {
    function createCalculatorClass() {
      class Calculator {}
      (reactive as Function)(Calculator.prototype, 'x');
      (reactive as Function)(Calculator.prototype, 'y');

      const desc = {
        value(this: Record<string, unknown>) {
          return (this.x as number) + (this.y as number);
        },
        writable: true,
        configurable: true,
        enumerable: false,
      };
      const result = (computed as Function)(Calculator.prototype, 'sum', desc);
      Object.defineProperty(Calculator.prototype, 'sum', result || desc);
      return Calculator;
    }

    it('returns computed value when called', () => {
      const Calculator = createCalculatorClass();
      const c = new Calculator() as Record<string, unknown>;
      c.x = 2;
      c.y = 3;
      expect((c.sum as Function)()).toBe(5);
    });

    it('re-evaluates when dependencies change', () => {
      const Calculator = createCalculatorClass();
      const c = new Calculator() as Record<string, unknown>;
      c.x = 2;
      c.y = 3;
      expect((c.sum as Function)()).toBe(5);
      c.x = 10;
      expect((c.sum as Function)()).toBe(13);
    });

    it('notifies subscribers', () => {
      const Calculator = createCalculatorClass();
      const c = new Calculator() as Record<string, unknown>;
      c.x = 2;
      c.y = 3;
      void (c.sum as Function)();
      const comp = getObservable(c, 'sum')!;
      const values: number[] = [];
      comp.subscribe((v: number) => values.push(v));

      c.x = 100;
      expect(values).toEqual([103]);
    });
  });
});

describe('legacy getObservable', () => {
  it('returns Observable for legacy @reactive properties', () => {
    class Model {}
    (reactive as Function)(Model.prototype, 'value');
    const m = new Model() as Record<string, unknown>;
    m.value = 1;
    const obs = getObservable(m, 'value');
    expect(obs).toBeInstanceOf(Observable);
  });

  it('returns ObservableArray for legacy @reactiveArray properties', () => {
    class Model {}
    (reactiveArray as Function)(Model.prototype, 'list');
    const m = new Model() as Record<string, unknown>;
    m.list = [];
    const obs = getObservable(m, 'list');
    expect(obs).toBeInstanceOf(ObservableArray);
  });

  it('returns undefined for non-decorated properties', () => {
    class Model {}
    const m = new Model() as Record<string, unknown>;
    expect(getObservable(m, 'nonExistent')).toBeUndefined();
  });
});

describe('legacy decorator interactions', () => {
  function createViewModelClass() {
    class ViewModel {}
    (reactive as Function)(ViewModel.prototype, 'firstName');
    (reactive as Function)(ViewModel.prototype, 'lastName');
    (reactiveArray as Function)(ViewModel.prototype, 'tags');

    const displayDesc = {
      get(this: Record<string, unknown>) {
        return `${this.firstName} ${this.lastName}`;
      },
      configurable: true,
      enumerable: true,
    };
    const result = (computed as Function)(ViewModel.prototype, 'displayName', displayDesc);
    Object.defineProperty(ViewModel.prototype, 'displayName', result || displayDesc);
    return ViewModel;
  }

  it('computed reacts to reactive property changes', () => {
    const ViewModel = createViewModelClass();
    const vm = new ViewModel() as Record<string, unknown>;
    vm.firstName = 'John';
    vm.lastName = 'Doe';
    vm.tags = ['admin'];
    expect(vm.displayName).toBe('John Doe');

    vm.firstName = 'Jane';
    expect(vm.displayName).toBe('Jane Doe');
  });

  it('computed notifies when underlying reactive changes', () => {
    const ViewModel = createViewModelClass();
    const vm = new ViewModel() as Record<string, unknown>;
    vm.firstName = 'John';
    vm.lastName = 'Doe';
    void vm.displayName;
    const comp = getObservable(vm, 'displayName')!;
    const spy = jasmine.createSpy('display');
    comp.subscribe(spy);

    vm.lastName = 'Smith';
    expect(spy).toHaveBeenCalledWith('John Smith');
  });

  it('replaceObservable works with legacy-decorated properties', () => {
    class Model {}
    (reactive as Function)(Model.prototype, 'value');
    const m = new Model() as Record<string, unknown>;
    m.value = 'original';

    const newObs = new Observable('replaced');
    replaceObservable(m, 'value', newObs);
    expect(m.value).toBe('replaced');
  });
});
