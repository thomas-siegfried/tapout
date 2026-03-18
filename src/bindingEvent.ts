import { Subscribable, Subscription } from './subscribable.js';
import { BindingContext, ANCESTOR_BINDING_INFO, BINDING_INFO_KEY } from './bindingContext.js';
import { domDataGet, domDataGetOrSet } from './domData.js';
import { addDisposeCallback, removeDisposeCallback } from './domNodeDisposal.js';
import { ignore } from './dependencyDetection.js';
import { virtualChildNodes, virtualFirstChild } from './virtualElements.js';

// ---- Binding Info (shared shape stored per-node via domData) ----

export interface BindingInfo {
  alreadyBound?: boolean;
  context?: BindingContext;
  eventSubscribable?: Subscribable;
  notifiedEvents?: Record<string, boolean>;
  asyncContext?: AsyncCompleteContext | null;
}

export function getBindingInfoForNode(node: Node): BindingInfo {
  return domDataGetOrSet(node, BINDING_INFO_KEY, {}) as BindingInfo;
}

// ---- AsyncCompleteContext ----

function asyncContextDispose(node: Node): void {
  const info = domDataGet(node, BINDING_INFO_KEY) as BindingInfo | undefined;
  const asyncContext = info?.asyncContext;
  if (asyncContext) {
    info!.asyncContext = null;
    asyncContext.notifyAncestor();
  }
}

class AsyncCompleteContext {
  node: Node;
  bindingInfo: BindingInfo;
  asyncDescendants: Node[] = [];
  childrenComplete = false;
  ancestorBindingInfo?: BindingInfo;

  constructor(node: Node, bindingInfo: BindingInfo, ancestorBindingInfo?: BindingInfo) {
    this.node = node;
    this.bindingInfo = bindingInfo;

    if (!bindingInfo.asyncContext) {
      addDisposeCallback(node, asyncContextDispose);
    }

    if (ancestorBindingInfo?.asyncContext) {
      ancestorBindingInfo.asyncContext.asyncDescendants.push(node);
      this.ancestorBindingInfo = ancestorBindingInfo;
    }
  }

  notifyAncestor(): void {
    if (this.ancestorBindingInfo?.asyncContext) {
      this.ancestorBindingInfo.asyncContext.descendantComplete(this.node);
    }
  }

  descendantComplete(node: Node): void {
    const idx = this.asyncDescendants.indexOf(node);
    if (idx !== -1) {
      this.asyncDescendants.splice(idx, 1);
    }
    if (this.asyncDescendants.length === 0 && this.childrenComplete) {
      this.completeChildren();
    }
  }

  completeChildren(): void {
    this.childrenComplete = true;
    if (this.bindingInfo.asyncContext && this.asyncDescendants.length === 0) {
      this.bindingInfo.asyncContext = null;
      removeDisposeCallback(this.node, asyncContextDispose);
      bindingEvent.notify(this.node, bindingEvent.descendantsComplete);
      this.notifyAncestor();
    }
  }
}

// ---- Binding Event API ----

export const bindingEvent = {
  childrenComplete: 'childrenComplete' as const,
  descendantsComplete: 'descendantsComplete' as const,

  subscribe(
    node: Node,
    event: string,
    callback: (value: unknown) => void,
    context?: unknown,
    options?: { notifyImmediately?: boolean },
  ): Subscription<unknown> {
    const bindingInfo = getBindingInfoForNode(node);
    if (!bindingInfo.eventSubscribable) {
      bindingInfo.eventSubscribable = new Subscribable();
    }

    if (options?.notifyImmediately && bindingInfo.notifiedEvents?.[event]) {
      ignore(() => callback.call(context, node));
    }

    const boundCallback = context ? (v: unknown) => callback.call(context, v) : callback;
    return bindingInfo.eventSubscribable.subscribe(boundCallback, event);
  },

  notify(node: Node, event: string): void {
    const bindingInfo = domDataGet(node, BINDING_INFO_KEY) as BindingInfo | undefined;
    if (bindingInfo) {
      if (!bindingInfo.notifiedEvents) {
        bindingInfo.notifiedEvents = {};
      }
      bindingInfo.notifiedEvents[event] = true;

      if (bindingInfo.eventSubscribable) {
        bindingInfo.eventSubscribable.notifySubscribers(node as unknown, event);
      }

      if (event === bindingEvent.childrenComplete) {
        if (bindingInfo.asyncContext) {
          bindingInfo.asyncContext.completeChildren();
        } else if (
          bindingInfo.asyncContext === undefined &&
          bindingInfo.eventSubscribable?.hasSubscriptionsForEvent(bindingEvent.descendantsComplete)
        ) {
          throw new Error('descendantsComplete event not supported for bindings on this node');
        }
      }
    }
  },

  startPossiblyAsyncContentBinding(node: Node, bindingContext: BindingContext): BindingContext {
    const bindingInfo = getBindingInfoForNode(node);

    if (!bindingInfo.asyncContext) {
      bindingInfo.asyncContext = new AsyncCompleteContext(
        node,
        bindingInfo,
        bindingContext[ANCESTOR_BINDING_INFO] as BindingInfo | undefined,
      );
    }

    if (bindingContext[ANCESTOR_BINDING_INFO] === bindingInfo) {
      return bindingContext;
    }

    return bindingContext.extend((ctx) => {
      ctx[ANCESTOR_BINDING_INFO] = bindingInfo;
      return {};
    });
  },
};

// ---- Helpers for applyBindings integration ----

export function subscribeToBindingEvent(
  node: Node,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  bindings: Record<string, any>,
  bindingContext: BindingContext,
  evaluateValueAccessor: (v: unknown) => unknown,
): BindingContext {
  let contextToExtend = bindingContext;

  if (bindingEvent.childrenComplete in bindings) {
    bindingEvent.subscribe(node, bindingEvent.childrenComplete, () => {
      const callback = evaluateValueAccessor(bindings[bindingEvent.childrenComplete]);
      if (callback) {
        const nodes = virtualChildNodes(node);
        if (nodes.length) {
          (callback as (nodes: Node[] | NodeListOf<ChildNode>, data: unknown) => void)(
            nodes,
            dataForFirstChild(node),
          );
        }
      }
    });
  }

  if (bindingEvent.descendantsComplete in bindings) {
    contextToExtend = bindingEvent.startPossiblyAsyncContentBinding(node, bindingContext);
    bindingEvent.subscribe(node, bindingEvent.descendantsComplete, () => {
      const callback = evaluateValueAccessor(bindings[bindingEvent.descendantsComplete]);
      if (callback && virtualFirstChild(node)) {
        (callback as (node: Node) => void)(node);
      }
    });
  }

  return contextToExtend;
}

function dataForFirstChild(node: Node): unknown {
  const first = virtualFirstChild(node);
  if (!first) return undefined;
  const info = domDataGet(first, BINDING_INFO_KEY) as BindingInfo | undefined;
  return info?.context?.$data;
}
