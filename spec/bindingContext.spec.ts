import { Window } from 'happy-dom';
import {
  BindingContext,
  contextFor,
  dataFor,
  SUBSCRIBABLE,
  BINDING_INFO_KEY,
  Observable,
  Computed,
  PureComputed,
} from '#src/index.js';
import { domDataSet } from '#src/domData.js';

const window = new Window();
const document = window.document;

describe('BindingContext', () => {

  describe('root context', () => {
    it('sets $data to the provided view model', () => {
      const vm = { name: 'root' };
      const ctx = new BindingContext(vm);
      expect(ctx.$data).toBe(vm);
    });

    it('sets $rawData to the same value for plain objects', () => {
      const vm = { name: 'root' };
      const ctx = new BindingContext(vm);
      expect(ctx.$rawData).toBe(vm);
    });

    it('sets $root to $data', () => {
      const vm = { name: 'root' };
      const ctx = new BindingContext(vm);
      expect(ctx.$root).toBe(vm);
    });

    it('sets $parents to an empty array', () => {
      const ctx = new BindingContext({ name: 'root' });
      expect(ctx.$parents).toEqual([]);
    });

    it('does not set $parent or $parentContext', () => {
      const ctx = new BindingContext({ name: 'root' });
      expect(ctx.$parent).toBeUndefined();
      expect(ctx.$parentContext).toBeUndefined();
    });
  });

  describe('root context with observable data', () => {
    it('unwraps an observable to set $data', () => {
      const obs = new Observable({ name: 'observed' });
      const ctx = new BindingContext(obs);
      expect(ctx.$data).toEqual({ name: 'observed' });
    });

    it('sets $rawData to the observable itself', () => {
      const obs = new Observable({ name: 'observed' });
      const ctx = new BindingContext(obs);
      expect(ctx.$rawData).toBe(obs);
    });
  });

  describe('root context with function data accessor', () => {
    it('calls the function to get $data', () => {
      const vm = { name: 'from function' };
      const ctx = new BindingContext(() => vm);
      expect(ctx.$data).toBe(vm);
    });

    it('unwraps if the function returns an observable', () => {
      const inner = { name: 'inner' };
      const obs = new Observable(inner);
      const ctx = new BindingContext(() => obs);
      expect(ctx.$data).toBe(inner);
      expect(ctx.$rawData).toBe(obs);
    });
  });

  describe('createChildContext', () => {
    it('creates a child with $parent pointing to parent $data', () => {
      const rootVm = { name: 'root' };
      const childVm = { name: 'child' };
      const root = new BindingContext(rootVm);
      const child = root.createChildContext(childVm);

      expect(child.$data).toBe(childVm);
      expect(child.$parent).toBe(rootVm);
    });

    it('sets $parentContext to the parent BindingContext', () => {
      const root = new BindingContext({ name: 'root' });
      const child = root.createChildContext({ name: 'child' });
      expect(child.$parentContext).toBe(root);
    });

    it('inherits $root from the parent', () => {
      const rootVm = { name: 'root' };
      const root = new BindingContext(rootVm);
      const child = root.createChildContext({ name: 'child' });
      expect(child.$root).toBe(rootVm);
    });

    it('builds $parents array with nearest parent first', () => {
      const rootVm = { name: 'root' };
      const childVm = { name: 'child' };
      const grandchildVm = { name: 'grandchild' };

      const root = new BindingContext(rootVm);
      const child = root.createChildContext(childVm);
      const grandchild = child.createChildContext(grandchildVm);

      expect(grandchild.$parents).toEqual([childVm, rootVm]);
      expect(grandchild.$parent).toBe(childVm);
      expect(grandchild.$root).toBe(rootVm);
    });

    it('accepts a string alias as the second argument', () => {
      const root = new BindingContext({ name: 'root' });
      const child = root.createChildContext({ name: 'item' }, 'item');
      expect((child as any).item).toEqual({ name: 'item' });
      expect(child.$data).toEqual({ name: 'item' });
    });

    it('accepts an options object with as', () => {
      const root = new BindingContext({ name: 'root' });
      const child = root.createChildContext({ name: 'item' }, { as: 'myItem' });
      expect((child as any).myItem).toEqual({ name: 'item' });
    });

    it('calls the extend callback', () => {
      const root = new BindingContext({ name: 'root' });
      const child = root.createChildContext({ name: 'item' }, {
        extend: (ctx) => {
          (ctx as any).$index = new Observable(0);
        },
      });
      expect((child as any).$index).toBeInstanceOf(Observable);
    });

    it('unwraps observable data in child context', () => {
      const obs = new Observable({ name: 'observed child' });
      const root = new BindingContext({ name: 'root' });
      const child = root.createChildContext(obs);
      expect(child.$data).toEqual({ name: 'observed child' });
      expect(child.$rawData).toBe(obs);
    });

    it('calls function data accessors in child context', () => {
      const childVm = { name: 'from fn' };
      const root = new BindingContext({ name: 'root' });
      const child = root.createChildContext(() => childVm);
      expect(child.$data).toBe(childVm);
    });
  });

  describe('createChildContext with noChildContext', () => {
    it('inherits $data from parent when noChildContext is true', () => {
      const rootVm = { name: 'root' };
      const root = new BindingContext(rootVm);
      const child = root.createChildContext('aliasValue', {
        as: 'myAlias',
        noChildContext: true,
      });

      expect(child.$data).toBe(rootVm);
      expect((child as any).myAlias).toBe('aliasValue');
    });

    it('does not change $parent or $parents', () => {
      const rootVm = { name: 'root' };
      const root = new BindingContext(rootVm);
      const child = root.createChildContext('val', {
        as: 'alias',
        noChildContext: true,
      });

      expect(child.$parents).toEqual([]);
      expect(child.$parent).toBeUndefined();
    });

    it('evaluates function accessors with noChildContext', () => {
      const root = new BindingContext({ name: 'root' });
      const child = root.createChildContext(() => 'computed value', {
        as: 'alias',
        noChildContext: true,
      });
      expect((child as any).alias).toBe('computed value');
    });
  });

  describe('extend', () => {
    it('creates a new context with additional properties', () => {
      const rootVm = { name: 'root' };
      const root = new BindingContext(rootVm);
      const extended = root.extend({ customProp: 42 });

      expect(extended.$data).toBe(rootVm);
      expect(extended.$root).toBe(rootVm);
      expect((extended as any).customProp).toBe(42);
    });

    it('does not change $parent or $parents', () => {
      const root = new BindingContext({ name: 'root' });
      const extended = root.extend({ extra: true });
      expect(extended.$parents).toEqual([]);
      expect(extended.$parent).toBeUndefined();
    });

    it('accepts a function that receives the context', () => {
      const rootVm = { name: 'root' };
      const root = new BindingContext(rootVm);
      const extended = root.extend((self) => ({
        doubled: (self.$data as any).name + '!',
      }));
      expect((extended as any).doubled).toBe('root!');
    });

    it('accepts null properties', () => {
      const root = new BindingContext({ name: 'root' });
      const extended = root.extend(null);
      expect(extended.$data).toEqual({ name: 'root' });
    });
  });

  describe('3-level deep hierarchy', () => {
    it('maintains the full context chain', () => {
      const level0 = { level: 0 };
      const level1 = { level: 1 };
      const level2 = { level: 2 };

      const ctx0 = new BindingContext(level0);
      const ctx1 = ctx0.createChildContext(level1);
      const ctx2 = ctx1.createChildContext(level2);

      expect(ctx2.$data).toBe(level2);
      expect(ctx2.$parent).toBe(level1);
      expect(ctx2.$parentContext).toBe(ctx1);
      expect(ctx2.$parents).toEqual([level1, level0]);
      expect(ctx2.$root).toBe(level0);

      expect(ctx1.$data).toBe(level1);
      expect(ctx1.$parent).toBe(level0);
      expect(ctx1.$parentContext).toBe(ctx0);
      expect(ctx1.$parents).toEqual([level0]);
      expect(ctx1.$root).toBe(level0);
    });
  });

  describe('dependency tracking', () => {
    it('has an active subscribable when data comes from an observable', () => {
      const obs = new Observable({ name: 'reactive' });
      const ctx = new BindingContext(obs);
      expect(ctx[SUBSCRIBABLE]).toBeDefined();
    });

    it('has no subscribable when data is static', () => {
      const ctx = new BindingContext({ name: 'static' });
      expect(ctx[SUBSCRIBABLE]).toBeUndefined();
    });

    it('has an active subscribable when data comes from a function reading observables', () => {
      const obs = new Observable('hello');
      const ctx = new BindingContext(() => obs.get());
      expect(ctx[SUBSCRIBABLE]).toBeDefined();
    });
  });

  describe('contextFor / dataFor', () => {
    it('returns undefined for nodes without binding context', () => {
      const div = document.createElement('div') as unknown as Node;
      expect(contextFor(div)).toBeUndefined();
      expect(dataFor(div)).toBeUndefined();
    });

    it('retrieves the stored binding context from a DOM element', () => {
      const div = document.createElement('div') as unknown as Node;
      const vm = { name: 'stored' };
      const ctx = new BindingContext(vm);

      domDataSet(div, BINDING_INFO_KEY, { context: ctx });

      expect(contextFor(div)).toBe(ctx);
      expect(dataFor(div)).toBe(vm);
    });

    it('returns undefined for text nodes', () => {
      const text = document.createTextNode('hello') as unknown as Node;
      domDataSet(text, BINDING_INFO_KEY, { context: new BindingContext({}) });
      expect(contextFor(text)).toBeUndefined();
    });

    it('works with comment nodes (nodeType 8)', () => {
      const comment = document.createComment('ko test') as unknown as Node;
      const vm = { name: 'comment' };
      const ctx = new BindingContext(vm);
      domDataSet(comment, BINDING_INFO_KEY, { context: ctx });

      expect(contextFor(comment)).toBe(ctx);
      expect(dataFor(comment)).toBe(vm);
    });
  });
});
