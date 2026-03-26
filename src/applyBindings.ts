import { BindingContext, BINDING_INFO_KEY, SUBSCRIBABLE, DATA_DEPENDENCY } from './bindingContext.js';
import type { AllBindingsAccessor } from './expressionRewriting.js';
import { instance as providerInstance, getBindingHandler } from './bindingProvider.js';
import type { BindingHandler } from './bindingProvider.js';
import { Computed } from './computed.js';
import { ignore } from './dependencyDetection.js';
import { domDataGetOrSet } from './domData.js';
import { addDisposeCallback } from './domNodeDisposal.js';
import {
  virtualFirstChild,
  virtualNextSibling,
  allowedVirtualElementBindings,
} from './virtualElements.js';
import { bindingEvent, subscribeToBindingEvent } from './bindingEvent.js';
import type { BindingInfo } from './bindingEvent.js';
import { ensureConfigured } from './configure.js';

interface SortedBinding {
  key: string;
  handler: BindingHandler;
}

// Elements whose descendants should not be recursively bound
const NO_RECURSE: Record<string, boolean> = {
  script: true,
  textarea: true,
  template: true,
};

function tagNameLower(node: Node): string {
  return (node as Element).tagName ? (node as Element).tagName.toLowerCase() : '';
}

// ---- Helpers ----

function evaluateValueAccessor(valueAccessor: unknown): unknown {
  return typeof valueAccessor === 'function' ? (valueAccessor as () => unknown)() : valueAccessor;
}

function makeValueAccessor(value: unknown): () => unknown {
  return () => value;
}

// ---- Topological Sort ----

function topologicalSortBindings(
  bindings: Record<string, unknown>,
): SortedBinding[] {
  const result: SortedBinding[] = [];
  const considered: Record<string, boolean> = {};
  const cyclicStack: string[] = [];

  function pushBinding(bindingKey: string) {
    if (considered[bindingKey]) return;

    const handler = getBindingHandler(bindingKey);
    if (handler) {
      if (handler.after) {
        cyclicStack.push(bindingKey);
        for (const depKey of handler.after) {
          if (depKey in bindings) {
            if (cyclicStack.indexOf(depKey) !== -1) {
              throw new Error(
                'Cannot combine the following bindings, because they have a cyclic dependency: ' +
                cyclicStack.join(', '),
              );
            }
            pushBinding(depKey);
          }
        }
        cyclicStack.pop();
      }
      result.push({ key: bindingKey, handler });
    }
    considered[bindingKey] = true;
  }

  for (const key of Object.keys(bindings)) {
    pushBinding(key);
  }

  return result;
}

// ---- Virtual Element Validation ----

function validateVirtualElementBinding(bindingName: string): void {
  if (!allowedVirtualElementBindings[bindingName]) {
    throw new Error("The binding '" + bindingName + "' cannot be used with virtual elements");
  }
}

// ---- Core: Apply Bindings to a Single Node ----

function applyBindingsToNodeInternal(
  node: Node,
  sourceBindings: Record<string, () => unknown> | ((ctx: BindingContext, node: Node) => Record<string, () => unknown>) | null,
  bindingContext: BindingContext,
): { shouldBindDescendants: boolean; bindingContextForDescendants: BindingContext | false } {
  const bindingInfo = domDataGetOrSet(node, BINDING_INFO_KEY, {}) as BindingInfo;

  const alreadyBound = bindingInfo.alreadyBound;
  if (!sourceBindings) {
    if (alreadyBound) {
      throw new Error('You cannot apply bindings multiple times to the same element.');
    }
    bindingInfo.alreadyBound = true;
  }
  if (!alreadyBound) {
    bindingInfo.context = bindingContext;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bindings: Record<string, any> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bindingsUpdater: Computed<any> | null = null;

  if (sourceBindings && typeof sourceBindings !== 'function') {
    bindings = sourceBindings;
  } else {
    const provider = providerInstance;
    const getBindingsFn = provider.getBindingAccessors.bind(provider);

    const updater = new Computed(() => {
      const resolved = sourceBindings
        ? (sourceBindings as (ctx: BindingContext, n: Node) => Record<string, () => unknown>)(bindingContext, node)
        : getBindingsFn(node, bindingContext);

      if (resolved) {
        const sub = bindingContext[SUBSCRIBABLE];
        if (sub) sub.get();
        const dep = bindingContext[DATA_DEPENDENCY] as Computed<unknown> | undefined;
        if (dep) dep.get();
      }
      bindings = resolved;
      return resolved;
    });

    bindings = updater.peek() as typeof bindings;

    if (!bindings || !updater.isActive()) {
      if (updater.isActive()) {
        addDisposeCallback(node, () => updater.dispose());
      }
      bindingsUpdater = null;
    } else {
      bindingsUpdater = updater;
      addDisposeCallback(node, () => updater.dispose());
    }
  }

  let contextToExtend = bindingContext;
  let bindingHandlerThatControlsDescendants: string | undefined;

  if (bindings) {
    contextToExtend = subscribeToBindingEvent(node, bindings, bindingContext, evaluateValueAccessor);

    const getValueAccessor: (key: string) => () => unknown = bindingsUpdater
      ? (bindingKey) => () => {
          const current = bindingsUpdater!.get() as Record<string, unknown> | null;
          return evaluateValueAccessor(current?.[bindingKey]);
        }
      : (bindingKey) => bindings![bindingKey] as () => unknown;

    const allBindings: AllBindingsAccessor = {
      get(key: string): unknown {
        return bindings![key] ? evaluateValueAccessor(getValueAccessor(key)) : undefined;
      },
      has(key: string): boolean {
        return key in bindings!;
      },
    };

    const orderedBindings = topologicalSortBindings(bindings);

    for (const { key: bindingKey, handler } of orderedBindings) {
      if (node.nodeType === 8) {
        validateVirtualElementBinding(bindingKey);
      }

      try {
        if (typeof handler.init === 'function') {
          const initFn = handler.init;
          ignore(() => {
            const initResult = initFn(
              node,
              getValueAccessor(bindingKey),
              allBindings,
              contextToExtend.$data,
              contextToExtend,
            );
            if (initResult && initResult.controlsDescendantBindings) {
              if (bindingHandlerThatControlsDescendants !== undefined) {
                throw new Error(
                  'Multiple bindings (' + bindingHandlerThatControlsDescendants + ' and ' + bindingKey +
                  ') are trying to control descendant bindings of the same element.',
                );
              }
              bindingHandlerThatControlsDescendants = bindingKey;
            }
          });
        }

        if (typeof handler.update === 'function') {
          const updateFn = handler.update;
          const updateComputed = new Computed(() => {
            updateFn(
              node,
              getValueAccessor(bindingKey),
              allBindings,
              contextToExtend.$data,
              contextToExtend,
            );
          });
          if (updateComputed.isActive()) {
            addDisposeCallback(node, () => updateComputed.dispose());
          }
        }
      } catch (ex) {
        const err = ex as Error;
        err.message =
          'Unable to process binding "' + bindingKey + ': ' + bindings[bindingKey] +
          '"\nMessage: ' + err.message;
        throw err;
      }
    }
  }

  const shouldBindDescendants = bindingHandlerThatControlsDescendants === undefined;
  return {
    shouldBindDescendants,
    bindingContextForDescendants: shouldBindDescendants && contextToExtend,
  };
}

// ---- Tree Walk ----

function applyBindingsToDescendantsInternal(
  bindingContext: BindingContext,
  elementOrVirtualElement: Node,
): void {
  let nextInQueue = virtualFirstChild(elementOrVirtualElement);

  if (nextInQueue) {
    const provider = providerInstance;
    const preprocessNode = provider.preprocessNode;

    if (preprocessNode) {
      let currentChild: Node | null = nextInQueue;
      while (currentChild) {
        const next = virtualNextSibling(currentChild);
        preprocessNode.call(provider, currentChild);
        currentChild = next;
      }
      nextInQueue = virtualFirstChild(elementOrVirtualElement);
    }

    let currentChild: Node | null = nextInQueue;
    while (currentChild) {
      const next = virtualNextSibling(currentChild);
      applyBindingsToNodeAndDescendantsInternal(bindingContext, currentChild);
      currentChild = next;
    }
  }

  bindingEvent.notify(elementOrVirtualElement, bindingEvent.childrenComplete);
}

function applyBindingsToNodeAndDescendantsInternal(
  bindingContext: BindingContext,
  nodeVerified: Node,
): void {
  let bindingContextForDescendants: BindingContext | false = bindingContext;

  const isElement = nodeVerified.nodeType === 1;

  const shouldApplyBindings = isElement || providerInstance.nodeHasBindings(nodeVerified);
  if (shouldApplyBindings) {
    const result = applyBindingsToNodeInternal(nodeVerified, null, bindingContext);
    bindingContextForDescendants = result.bindingContextForDescendants;
  }

  if (bindingContextForDescendants && !NO_RECURSE[tagNameLower(nodeVerified)]) {
    applyBindingsToDescendantsInternal(bindingContextForDescendants, nodeVerified);
  }
}

// ---- Utility: Wrap raw bindings as accessors ----

function makeBindingAccessors(
  bindings: Record<string, unknown> | ((ctx: BindingContext, node: Node) => Record<string, unknown>),
  context: BindingContext,
  node: Node,
): Record<string, () => unknown> {
  if (typeof bindings === 'function') {
    const boundFn = (bindings as (ctx: BindingContext, node: Node) => Record<string, unknown>).bind(null, context, node);
    const initial = ignore(boundFn);
    const result: Record<string, () => unknown> = {};
    for (const key of Object.keys(initial)) {
      result[key] = () => boundFn()[key];
    }
    return result;
  }
  const result: Record<string, () => unknown> = {};
  for (const key of Object.keys(bindings)) {
    result[key] = makeValueAccessor(bindings[key]);
  }
  return result;
}

// ---- Public Helpers ----

function getBindingContext(
  viewModelOrBindingContext: unknown,
  extendContextCallback?: (self: BindingContext, parentContext: BindingContext | undefined, dataItem: unknown) => void,
): BindingContext {
  if (viewModelOrBindingContext instanceof BindingContext) {
    return viewModelOrBindingContext;
  }
  return new BindingContext(viewModelOrBindingContext, undefined, undefined, extendContextCallback);
}

// ---- Public API ----

export function applyBindings(
  viewModelOrBindingContext: unknown,
  rootNode: Node,
  extendContextCallback?: (self: BindingContext, parentContext: BindingContext | undefined, dataItem: unknown) => void,
): void {
  ensureConfigured();
  if (!rootNode || (rootNode.nodeType !== 1 && rootNode.nodeType !== 8)) {
    throw new Error('applyBindings: second parameter should be a DOM element or comment node');
  }
  applyBindingsToNodeAndDescendantsInternal(
    getBindingContext(viewModelOrBindingContext, extendContextCallback),
    rootNode,
  );
}

export function applyBindingsToDescendants(
  viewModelOrBindingContext: unknown,
  rootNode: Node,
): void {
  ensureConfigured();
  if (rootNode.nodeType === 1 || rootNode.nodeType === 8) {
    applyBindingsToDescendantsInternal(
      getBindingContext(viewModelOrBindingContext),
      rootNode,
    );
  }
}

export function applyBindingsToNode(
  node: Node,
  bindings: Record<string, unknown>,
  viewModelOrBindingContext?: unknown,
): { shouldBindDescendants: boolean } {
  ensureConfigured();
  const context = getBindingContext(viewModelOrBindingContext);
  const accessors = makeBindingAccessors(bindings, context, node);
  return applyBindingsToNodeInternal(node, accessors, context);
}

export function applyBindingAccessorsToNode(
  node: Node,
  bindings: Record<string, () => unknown> | ((ctx: BindingContext, node: Node) => Record<string, () => unknown>),
  viewModelOrBindingContext?: unknown,
): { shouldBindDescendants: boolean } {
  ensureConfigured();
  const context = getBindingContext(viewModelOrBindingContext);
  return applyBindingsToNodeInternal(node, bindings, context);
}
