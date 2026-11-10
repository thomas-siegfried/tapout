import { Window } from 'happy-dom';
import {
  applyBindings,
  bindingHandlers,
  bindingProviderInstance,
  cleanNode,
  components,
  Computed,
  Observable,
  options,
  preProcessBindings,
  reactive,
} from '#src/index.js';
import { resolveObservableRef, CONTEXT_KEYWORDS } from '#src/observableRefs.js';

const window = new Window();
const document = window.document;
(globalThis as Record<string, unknown>).document = document;

function bind(bindings: string, vm: unknown): HTMLElement {
  const el = document.createElement('div') as unknown as HTMLElement;
  el.setAttribute('data-bind', bindings);
  document.body.appendChild(el as never);
  applyBindings(vm, el as unknown as Node);
  return el;
}

function dispose(el: HTMLElement): void {
  cleanNode(el as unknown as Node);
  document.body.removeChild(el as never);
}

class ReactiveVm {
  @reactive accessor count: number = 1;
}

describe('resolveObservableRef', () => {
  it('returns the backing observable of a @reactive accessor', () => {
    const vm = new ReactiveVm();
    const ref = resolveObservableRef(vm, 'count');
    expect(ref instanceof Observable).toBe(true);
    (ref as Observable<number>).set(5);
    expect(vm.count).toBe(5);
  });

  it('returns the property value for a plain field', () => {
    const obs = new Observable(1);
    expect(resolveObservableRef({ value: obs }, 'value')).toBe(obs);
    expect(resolveObservableRef({ value: 3 }, 'value')).toBe(3);
  });

  it('returns undefined for non-object data', () => {
    expect(resolveObservableRef(null, 'x')).toBeUndefined();
    expect(resolveObservableRef(5, 'x')).toBeUndefined();
  });

  it('knows the context keywords', () => {
    for (const k of ['$data', '$parent', '$root', '$index', '$context', '$element', '$component']) {
      expect(CONTEXT_KEYWORDS.has(k)).toBe(true);
    }
  });
});

describe('preProcessBindings with observableRefs', () => {
  it('rewrites a bare $ref value', () => {
    expect(preProcessBindings('test: $foo', { observableRefs: true }))
      .toBe("'test':$ref($data,'foo')");
  });

  it('wraps the rewritten value in an accessor when valueAccessors is set', () => {
    expect(preProcessBindings('test: $foo', { observableRefs: true, valueAccessors: true }))
      .toBe("'test':function(){return $ref($data,'foo') }");
  });

  it('rewrites object-literal property values recursively', () => {
    const out = preProcessBindings("component: { name: 'x', params: { a: $foo, b: 1 } }", { observableRefs: true });
    expect(out).toContain("$ref($data,'foo')");
    expect(out).toContain('"name":\'x\'');
    expect(out).toContain('"b":1');
  });

  it('does not rewrite context keywords', () => {
    expect(preProcessBindings('test: $data', { observableRefs: true })).toBe("'test':$data");
    expect(preProcessBindings('test: $parent', { observableRefs: true })).toBe("'test':$parent");
    expect(preProcessBindings('test: $index', { observableRefs: true })).toBe("'test':$index");
  });

  it('does not rewrite $ inside strings', () => {
    expect(preProcessBindings("text: '$5'", { observableRefs: true })).toBe("'text':'$5'");
  });

  it('does not rewrite arbitrary expressions', () => {
    expect(preProcessBindings('test: $a + 1', { observableRefs: true })).toBe("'test':$a + 1");
    expect(preProcessBindings('test: fn($a)', { observableRefs: true })).toBe("'test':fn($a)");
  });

  it('leaves object literals without refs untouched', () => {
    const input = 'test: { a: 1, b: x }';
    expect(preProcessBindings(input, { observableRefs: true })).toBe(preProcessBindings(input));
  });

  it('does nothing when the option is off', () => {
    expect(preProcessBindings('test: $foo')).toBe("'test':$foo");
  });

  it('does not generate a property writer for a $ref on a two-way binding', () => {
    const out = preProcessBindings('value: $foo', { observableRefs: true });
    expect(out).not.toContain('_tap_property_writers');
  });
});

describe('$prop observable refs in data-bind', () => {
  const key = 'testRef';
  let received: unknown;

  beforeEach(() => {
    received = undefined;
    options.observableRefs = true;
    bindingHandlers[key] = {
      init(_el: Node, valueAccessor: () => unknown) {
        received = valueAccessor();
      },
    };
  });

  afterEach(() => {
    delete bindingHandlers[key];
    options.observableRefs = false;
    components._resetForTesting();
  });

  it('hands the backing Observable of a @reactive property to the handler', () => {
    const vm = new ReactiveVm();
    const el = bind(key + ': $count', vm);

    expect(received instanceof Observable).toBe(true);
    (received as Observable<number>).set(42);
    expect(vm.count).toBe(42);

    dispose(el);
  });

  it('resolves $prop and prop to the same instance for a plain Observable field', () => {
    const vm = { value: new Observable(1) };

    const el1 = bind(key + ': $value', vm);
    const viaRef = received;
    dispose(el1);

    const el2 = bind(key + ': value', vm);
    const viaName = received;
    dispose(el2);

    expect(viaRef).toBe(vm.value);
    expect(viaName).toBe(vm.value);
  });

  it('passes a Computed field through as-is', () => {
    const vm = { doubled: new Computed(() => 2) };
    const el = bind(key + ': $doubled', vm);
    expect(received).toBe(vm.doubled);
    dispose(el);
  });

  it('resolves nested object-literal values', () => {
    const vm = new ReactiveVm();
    const el = bind(key + ': { result: $count, other: 5 }', vm);

    const opts = received as { result: unknown; other: number };
    expect(opts.result instanceof Observable).toBe(true);
    expect(opts.other).toBe(5);
    (opts.result as Observable<number>).set(9);
    expect(vm.count).toBe(9);

    dispose(el);
  });

  it('works inside component params for two-way sharing', () => {
    let shared: unknown;
    components.register('ref-comp', {
      template: '<span></span>',
      viewModel: function (this: unknown, params: { value: unknown }) {
        shared = params.value;
      } as never,
      synchronous: true,
    });
    const vm = new ReactiveVm();
    const el = bind("component: { name: 'ref-comp', params: { value: $count } }", vm);

    expect(shared instanceof Observable).toBe(true);
    (shared as Observable<number>).set(11);
    expect(vm.count).toBe(11);

    dispose(el);
  });

  it('does not rewrite context keywords', () => {
    const vm = new ReactiveVm();
    const el = bind(key + ': $data', vm);
    expect(received).toBe(vm);
    dispose(el);
  });

  it('does not rewrite $ inside strings', () => {
    const el = bind(key + ": '$5'", {});
    expect(received).toBe('$5');
    dispose(el);
  });

  it('does not rewrite arbitrary expressions', () => {
    const el = bind(key + ': $a + 1', { $a: 2 });
    expect(received).toBe(3);
    dispose(el);
  });

  it('compiles the same binding string once and resolves per context', () => {
    const vm1 = { cachedRef: new Observable(1) };
    const vm2 = { cachedRef: new Observable(2) };
    const bindingString = key + ': $cachedRef';

    const el1 = bind(bindingString, vm1);
    expect(received).toBe(vm1.cachedRef);
    const el2 = bind(bindingString, vm2);
    expect(received).toBe(vm2.cachedRef);

    const matching = Object.keys(bindingProviderInstance.bindingCache)
      .filter(k => k.startsWith(bindingString));
    expect(matching.length).toBe(1);

    dispose(el1);
    dispose(el2);
  });

  it('behaves as before when the option is off', () => {
    options.observableRefs = false;

    expect(() => bind(key + ': $count', new ReactiveVm())).toThrow();

    const el = bind(key + ': $count', { $count: 'literal' });
    expect(received).toBe('literal');
    dispose(el);
  });

  it('keeps the custom element params $ syntax working regardless of the option', () => {
    options.observableRefs = false;
    let shared: unknown;
    components.register('ref-el', {
      template: '<span></span>',
      viewModel: function (this: unknown, params: { value: unknown }) {
        shared = params.value;
      } as never,
      synchronous: true,
    });
    const vm = new ReactiveVm();
    const container = document.createElement('div');
    container.innerHTML = '<ref-el params="value: $count"></ref-el>';
    document.body.appendChild(container as never);

    applyBindings(vm, container as unknown as Node);

    expect(shared instanceof Observable).toBe(true);

    cleanNode(container as unknown as Node);
    document.body.removeChild(container as never);
  });
});
