import {
  reactive,
  reactiveArray,
  computed,
  getObservable,
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
