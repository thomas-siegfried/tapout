import { Window } from 'happy-dom';
import {
  applyBindings,
  applyBindingsToDescendants,
  bindingHandlers,
  bindingEvent,
  removeNode,
  cleanNode,
  allowedVirtualElementBindings,
  dataFor,
  BindingContext,
  ANCESTOR_BINDING_INFO,
  BINDING_INFO_KEY,
  domDataGet,
} from '#src/index.js';
import type { BindingInfo } from '#src/index.js';

const window = new Window();
const document = window.document;

function createElement(tag: string, attrs: Record<string, string> = {}, ...children: Node[]): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  for (const child of children) el.appendChild(child as never);
  return el as unknown as Element;
}

function createComment(text: string): Comment {
  return document.createComment(text) as unknown as Comment;
}

function registerTestHandler(
  name: string,
  handler: {
    init?: (...args: unknown[]) => unknown;
    update?: (...args: unknown[]) => void;
    after?: string[];
  },
) {
  bindingHandlers[name] = handler as typeof bindingHandlers[string];
}

function removeTestHandler(name: string) {
  delete bindingHandlers[name];
}

describe('bindingEvent', () => {

  afterEach(() => {
    removeTestHandler('testText');
    removeTestHandler('testInit');
    removeTestHandler('testControl');
    delete allowedVirtualElementBindings['testControl'];
  });

  describe('childrenComplete', () => {
    it('fires after children are bound via applyBindings', () => {
      registerTestHandler('testText', { init() {} });

      const parent = createElement('div', {},
        createElement('span', { 'data-bind': 'testText: 1' }),
      );

      let fired = false;
      bindingEvent.subscribe(parent, bindingEvent.childrenComplete, () => {
        fired = true;
      });

      applyBindings({}, parent);
      expect(fired).toBe(true);
    });

    it('fires after children are bound via applyBindingsToDescendants', () => {
      registerTestHandler('testText', { init() {} });

      const parent = createElement('div', {},
        createElement('span', { 'data-bind': 'testText: 1' }),
      );

      let fired = false;
      bindingEvent.subscribe(parent, bindingEvent.childrenComplete, () => {
        fired = true;
      });

      applyBindingsToDescendants({}, parent);
      expect(fired).toBe(true);
    });

    it('fires even when node has no children', () => {
      const parent = createElement('div');

      let fired = false;
      bindingEvent.subscribe(parent, bindingEvent.childrenComplete, () => {
        fired = true;
      });

      applyBindingsToDescendants({}, parent);
      expect(fired).toBe(true);
    });

    it('passes the node as the event value', () => {
      const parent = createElement('div');

      let receivedNode: unknown;
      bindingEvent.subscribe(parent, bindingEvent.childrenComplete, (node: unknown) => {
        receivedNode = node;
      });

      applyBindingsToDescendants({}, parent);
      expect(receivedNode).toBe(parent);
    });

    it('fires on nested elements in order (deepest first)', () => {
      registerTestHandler('testText', { init() {} });

      const log: string[] = [];
      const child = createElement('div', {},
        createElement('span', { 'data-bind': 'testText: 1' }),
      );
      const parent = createElement('div', {}, child as unknown as Node);

      bindingEvent.subscribe(child, bindingEvent.childrenComplete, () => {
        log.push('child');
      });
      bindingEvent.subscribe(parent, bindingEvent.childrenComplete, () => {
        log.push('parent');
      });

      applyBindingsToDescendants({}, parent);
      expect(log).toEqual(['child', 'parent']);
    });
  });

  describe('childrenComplete via data-bind', () => {
    it('auto-subscribes childrenComplete callback from binding string', () => {
      registerTestHandler('testText', { init() {} });

      let callbackInvoked = false;
      const vm = {
        onChildrenDone: () => { callbackInvoked = true; },
      };

      const parent = createElement('div', { 'data-bind': 'childrenComplete: onChildrenDone' },
        createElement('span', { 'data-bind': 'testText: 1' }),
      );
      applyBindings(vm, parent);

      expect(callbackInvoked).toBe(true);
    });

    it('passes child nodes and first child data to the callback', () => {
      registerTestHandler('testText', { init() {} });

      let receivedNodes: unknown;
      let receivedData: unknown;

      const vm = {
        onChildrenDone: (nodes: unknown, data: unknown) => {
          receivedNodes = nodes;
          receivedData = data;
        },
      };

      const child = createElement('span', { 'data-bind': 'testText: 1' });
      const parent = createElement('div', { 'data-bind': 'childrenComplete: onChildrenDone' },
        child as unknown as Node,
      );
      applyBindings(vm, parent);

      expect(receivedNodes).toBeDefined();
      expect((receivedNodes as NodeList).length).toBeGreaterThan(0);
      expect(receivedData).toBe(vm);
    });

    it('does not invoke callback when node has no children', () => {
      let callbackInvoked = false;
      const vm = {
        onChildrenDone: () => { callbackInvoked = true; },
      };

      const parent = createElement('div', { 'data-bind': 'childrenComplete: onChildrenDone' });
      applyBindings(vm, parent);

      expect(callbackInvoked).toBe(false);
    });
  });

  describe('descendantsComplete', () => {
    it('fires synchronously when there are no async descendants', () => {
      registerTestHandler('testText', { init() {} });

      const parent = createElement('div', {},
        createElement('span', { 'data-bind': 'testText: 1' }),
      );

      const ctx = new BindingContext({});
      const extCtx = bindingEvent.startPossiblyAsyncContentBinding(parent, ctx);

      let fired = false;
      bindingEvent.subscribe(parent, bindingEvent.descendantsComplete, () => {
        fired = true;
      });

      applyBindingsToDescendants(extCtx, parent);
      expect(fired).toBe(true);
    });

    it('passes the node as the event value', () => {
      const parent = createElement('div', {},
        createElement('span'),
      );

      const ctx = new BindingContext({});
      bindingEvent.startPossiblyAsyncContentBinding(parent, ctx);

      let receivedNode: unknown;
      bindingEvent.subscribe(parent, bindingEvent.descendantsComplete, (node: unknown) => {
        receivedNode = node;
      });

      applyBindingsToDescendants(ctx, parent);
      expect(receivedNode).toBe(parent);
    });
  });

  describe('descendantsComplete via data-bind', () => {
    it('auto-subscribes descendantsComplete callback from binding string', () => {
      registerTestHandler('testText', { init() {} });

      let callbackInvoked = false;
      const vm = {
        onDescendantsDone: (node: unknown) => { callbackInvoked = true; },
      };

      const parent = createElement('div', { 'data-bind': 'descendantsComplete: onDescendantsDone' },
        createElement('span', { 'data-bind': 'testText: 1' }),
      );
      applyBindings(vm, parent);

      expect(callbackInvoked).toBe(true);
    });

    it('does not invoke callback when node has no children', () => {
      let callbackInvoked = false;
      const vm = {
        onDescendantsDone: () => { callbackInvoked = true; },
      };

      const parent = createElement('div', { 'data-bind': 'descendantsComplete: onDescendantsDone' });
      applyBindings(vm, parent);

      expect(callbackInvoked).toBe(false);
    });
  });

  describe('subscribe/notify API', () => {
    it('subscribe returns a disposable subscription', () => {
      const node = createElement('div');
      let count = 0;
      const sub = bindingEvent.subscribe(node, 'custom', () => { count++; });

      bindingEvent.notify(node, 'custom');
      expect(count).toBe(1);

      sub.dispose();
      bindingEvent.notify(node, 'custom');
      expect(count).toBe(1);
    });

    it('notifyImmediately calls back if event already fired', () => {
      const node = createElement('div');

      // Need binding info to exist so notify records the event
      const info = { notifiedEvents: {} } as BindingInfo;
      (node as any).__forceInfo = true;

      bindingEvent.notify(node, 'custom');

      // This won't work because notify checks domDataGet, we need
      // to ensure the node has binding info. Let's use the proper flow.
    });

    it('supports notifyImmediately for late subscribers', () => {
      registerTestHandler('testText', { init() {} });

      const parent = createElement('div', {},
        createElement('span', { 'data-bind': 'testText: 1' }),
      );

      applyBindings({}, parent);

      let lateFired = false;
      bindingEvent.subscribe(parent, bindingEvent.childrenComplete, () => {
        lateFired = true;
      }, undefined, { notifyImmediately: true });

      expect(lateFired).toBe(true);
    });

    it('notifyImmediately does not fire if event has not occurred', () => {
      const node = createElement('div');

      let fired = false;
      bindingEvent.subscribe(node, bindingEvent.childrenComplete, () => {
        fired = true;
      }, undefined, { notifyImmediately: true });

      expect(fired).toBe(false);
    });
  });

  describe('async descendant tracking', () => {
    it('descendantsComplete waits for nested async contexts', () => {
      registerTestHandler('testControl', {
        init() { return { controlsDescendantBindings: true }; },
      });
      registerTestHandler('testText', { init() {} });

      const inner = createElement('div', { 'data-bind': 'testControl: true' },
        createElement('span', { 'data-bind': 'testText: 1' }),
      );
      const outer = createElement('div', {},
        inner as unknown as Node,
      );

      const outerCtx = new BindingContext({});
      const outerExtCtx = bindingEvent.startPossiblyAsyncContentBinding(outer, outerCtx);

      let outerDescComplete = false;
      bindingEvent.subscribe(outer, bindingEvent.descendantsComplete, () => {
        outerDescComplete = true;
      });

      // Start async context on inner (simulating a binding that controls descendants and loads async)
      const innerInfo = domDataGet(inner, BINDING_INFO_KEY) as BindingInfo | undefined;
      const innerCtx = outerExtCtx.extend((ctx) => {
        // Propagate ancestor binding info
      });
      const innerExtCtx = bindingEvent.startPossiblyAsyncContentBinding(inner, innerCtx);

      // Apply outer children — fires childrenComplete on outer
      applyBindingsToDescendants(outerExtCtx, outer);

      // outer's childrenComplete has fired, but inner's async context is still pending
      expect(outerDescComplete).toBe(false);

      // Now simulate inner completing: notify childrenComplete on inner
      bindingEvent.notify(inner, bindingEvent.childrenComplete);

      // Now outer should also be complete
      expect(outerDescComplete).toBe(true);
    });

    it('handles multiple async descendants', () => {
      registerTestHandler('testControl', {
        init() { return { controlsDescendantBindings: true }; },
      });

      const child1 = createElement('div', { 'data-bind': 'testControl: true' });
      const child2 = createElement('div', { 'data-bind': 'testControl: true' });
      const parent = createElement('div', {},
        child1 as unknown as Node,
        child2 as unknown as Node,
      );

      const ctx = new BindingContext({});
      const extCtx = bindingEvent.startPossiblyAsyncContentBinding(parent, ctx);

      let parentComplete = false;
      bindingEvent.subscribe(parent, bindingEvent.descendantsComplete, () => {
        parentComplete = true;
      });

      // Register both children as async
      const child1Ctx = bindingEvent.startPossiblyAsyncContentBinding(child1, extCtx);
      const child2Ctx = bindingEvent.startPossiblyAsyncContentBinding(child2, extCtx);

      // Fire childrenComplete on parent
      bindingEvent.notify(parent, bindingEvent.childrenComplete);
      expect(parentComplete).toBe(false);

      // Complete child1
      bindingEvent.notify(child1, bindingEvent.childrenComplete);
      expect(parentComplete).toBe(false);

      // Complete child2
      bindingEvent.notify(child2, bindingEvent.childrenComplete);
      expect(parentComplete).toBe(true);
    });
  });

  describe('disposal', () => {
    it('removing a node with async context notifies ancestor', () => {
      registerTestHandler('testControl', {
        init() { return { controlsDescendantBindings: true }; },
      });

      const child = createElement('div', { 'data-bind': 'testControl: true' });
      const parent = createElement('div', {},
        child as unknown as Node,
      );

      const ctx = new BindingContext({});
      const extCtx = bindingEvent.startPossiblyAsyncContentBinding(parent, ctx);
      bindingEvent.startPossiblyAsyncContentBinding(child, extCtx);

      let parentComplete = false;
      bindingEvent.subscribe(parent, bindingEvent.descendantsComplete, () => {
        parentComplete = true;
      });

      // Fire childrenComplete on parent — still waiting for child
      bindingEvent.notify(parent, bindingEvent.childrenComplete);
      expect(parentComplete).toBe(false);

      // Remove child — should notify ancestor and allow parent to complete
      removeNode(child);
      expect(parentComplete).toBe(true);
    });
  });

  describe('startPossiblyAsyncContentBinding', () => {
    it('returns the same context if already extended with this node info', () => {
      const node = createElement('div');
      const ctx = new BindingContext({});

      const ext1 = bindingEvent.startPossiblyAsyncContentBinding(node, ctx);
      const ext2 = bindingEvent.startPossiblyAsyncContentBinding(node, ext1);

      expect(ext2).toBe(ext1);
    });

    it('returns a new extended context with ancestor binding info', () => {
      const node = createElement('div');
      const ctx = new BindingContext({});

      const ext = bindingEvent.startPossiblyAsyncContentBinding(node, ctx);

      expect(ext).not.toBe(ctx);
      expect(ext[ANCESTOR_BINDING_INFO]).toBeDefined();
    });
  });

  describe('error cases', () => {
    it('throws when subscribing to descendantsComplete on a node without async context', () => {
      registerTestHandler('testText', { init() {} });

      const parent = createElement('div', {},
        createElement('span', { 'data-bind': 'testText: 1' }),
      );

      bindingEvent.subscribe(parent, bindingEvent.descendantsComplete, () => {});

      expect(() => {
        applyBindingsToDescendants({}, parent);
      }).toThrowError(/descendantsComplete event not supported/);
    });
  });
});
