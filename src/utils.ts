import { PureComputed } from './computed.js';
import { isReadableSubscribable } from './subscribable.js';
import type { ReadableSubscribable, Subscription } from './subscribable.js';
import { cleanNode, removeNode } from './domNodeDisposal.js';
import { options } from './options.js';

const MAX_NESTED_OBSERVABLE_DEPTH = 10;

export function unwrapObservable(value: unknown): unknown {
  for (let i = 0; isReadableSubscribable(value) && i < MAX_NESTED_OBSERVABLE_DEPTH; i++) {
    value = value.get();
  }
  return value;
}

export function peekObservable(value: unknown): unknown {
  for (let i = 0; isReadableSubscribable(value) && i < MAX_NESTED_OBSERVABLE_DEPTH; i++) {
    value = value.peek();
  }
  return value;
}

function canHaveProperties(obj: unknown): obj is Record<string | number, unknown> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    !(obj instanceof RegExp) &&
    !(obj instanceof Date) &&
    !(obj instanceof String) &&
    !(obj instanceof Number) &&
    !(obj instanceof Boolean)
  );
}

function mapJsObjectGraph(
  rootObject: unknown,
  visited: Map<object, unknown>,
): unknown {
  rootObject = peekObservable(rootObject);

  if (!canHaveProperties(rootObject)) {
    return rootObject;
  }

  const previouslyMapped = visited.get(rootObject);
  if (previouslyMapped !== undefined) {
    return previouslyMapped;
  }

  const isArray = Array.isArray(rootObject);
  const output: Record<string, unknown> | unknown[] = isArray ? [] as unknown[] : {};
  visited.set(rootObject, output);

  if (isArray) {
    const arr = rootObject as unknown as unknown[];
    const out = output as unknown[];
    for (let i = 0; i < arr.length; i++) {
      const propertyValue = peekObservable(arr[i]);
      out[i] = canHaveProperties(propertyValue)
        ? (visited.get(propertyValue as object) ?? mapJsObjectGraph(propertyValue, visited))
        : propertyValue;
    }
  } else {
    const out = output as Record<string, unknown>;
    for (const key in rootObject) {
      const propertyValue = peekObservable(rootObject[key]);
      out[key] = canHaveProperties(propertyValue)
        ? (visited.get(propertyValue as object) ?? mapJsObjectGraph(propertyValue, visited))
        : propertyValue;
    }
  }

  return output;
}

export function toJS<T>(rootObject: T): unknown {
  return mapJsObjectGraph(rootObject, new Map());
}

export function toJSON(
  rootObject: unknown,
  replacer?: (key: string, value: unknown) => unknown,
  space?: string | number,
): string {
  const plainObject = toJS(rootObject);
  return JSON.stringify(plainObject, replacer as Parameters<typeof JSON.stringify>[1], space);
}

export function when(
  predicate: () => unknown,
  callback?: (value: unknown) => void,
): Promise<unknown> | Subscription<unknown> {
  function kowhen(resolve: (value: unknown) => void): Subscription<unknown> {
    const observable = new PureComputed(predicate);
    observable.extend({ notify: 'always' });
    const subscription = observable.subscribe((value: unknown) => {
      if (value) {
        subscription.dispose();
        observable.dispose();
        resolve(value);
      }
    });
    observable.notifySubscribers(observable.peek());
    return subscription;
  }

  if (!callback) {
    return new Promise(kowhen);
  } else {
    return kowhen(callback);
  }
}

export function cloneNodes(nodesArray: Node[], shouldCleanNodes?: boolean): Node[] {
  const result: Node[] = [];
  for (let i = 0; i < nodesArray.length; i++) {
    const cloned = nodesArray[i].cloneNode(true);
    result.push(shouldCleanNodes ? cleanNode(cloned) : cloned);
  }
  return result;
}

export function fixUpContinuousNodeArray(continuousNodeArray: Node[], parentNode: Node): Node[] {
  if (continuousNodeArray.length) {
    parentNode = (parentNode.nodeType === 8 && parentNode.parentNode) || parentNode;

    // Rule [A]: Strip detached leading nodes
    while (continuousNodeArray.length && continuousNodeArray[0].parentNode !== parentNode)
      continuousNodeArray.splice(0, 1);

    // Rule [B]: Strip detached trailing nodes
    while (continuousNodeArray.length > 1 && continuousNodeArray[continuousNodeArray.length - 1].parentNode !== parentNode)
      continuousNodeArray.length--;

    // Rule [C]: Fill in to maintain continuity
    if (continuousNodeArray.length > 1) {
      const first = continuousNodeArray[0];
      const last = continuousNodeArray[continuousNodeArray.length - 1];
      continuousNodeArray.length = 0;
      let current: Node | null = first;
      while (current !== last) {
        continuousNodeArray.push(current!);
        current = current!.nextSibling;
      }
      continuousNodeArray.push(last);
    }
  }
  return continuousNodeArray;
}

export function replaceDomNodes(nodeToReplaceOrNodeArray: Node | Node[], newNodesArray: Node[]): void {
  const nodesToReplace = 'nodeType' in nodeToReplaceOrNodeArray
    ? [nodeToReplaceOrNodeArray as Node]
    : nodeToReplaceOrNodeArray as Node[];
  if (nodesToReplace.length > 0) {
    const insertionPoint = nodesToReplace[0];
    const parent = insertionPoint.parentNode!;
    for (let i = 0; i < newNodesArray.length; i++)
      parent.insertBefore(newNodesArray[i], insertionPoint);
    for (let i = 0; i < nodesToReplace.length; i++)
      removeNode(nodesToReplace[i]);
  }
}

export function moveCleanedNodesToContainerElement(nodes: ArrayLike<Node>): HTMLElement {
  const nodesArray = Array.from(nodes);
  const doc = (nodesArray[0] && nodesArray[0].ownerDocument) || document;
  const container = doc.createElement('div');
  for (let i = 0; i < nodesArray.length; i++) {
    container.appendChild(cleanNode(nodesArray[i]));
  }
  return container;
}

export function parseHtmlFragment(html: string, documentContext?: Document): Node[] {
  const doc = documentContext || document;
  const div = doc.createElement('div');
  div.innerHTML = html;
  return Array.from(div.childNodes);
}

export function domNodeIsAttachedToDocument(node: Node): boolean {
  let current: Node | null = node;
  const root = node.ownerDocument?.documentElement;
  if (!root) return false;
  while (current) {
    if (current === root) return true;
    current = current.parentNode;
  }
  return false;
}

export function anyDomNodeIsAttachedToDocument(nodes: Node[]): boolean {
  for (let i = 0; i < nodes.length; i++) {
    if (domNodeIsAttachedToDocument(nodes[i])) return true;
  }
  return false;
}

export function catchFunctionErrors<T extends (...args: never[]) => unknown>(delegate: T): T {
  if (!options.onError) return delegate;
  return function (this: unknown, ...args: Parameters<T>) {
    try {
      return delegate.apply(this, args);
    } catch (e) {
      options.onError?.(e);
      throw e;
    }
  } as unknown as T;
}
