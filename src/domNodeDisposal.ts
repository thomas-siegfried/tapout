import { domDataGet, domDataSet, domDataClear, domDataNextKey } from './domData.js';
import { ignore } from './dependencyDetection.js';

type DisposeCallback = (node: Node) => void;

const disposeCallbacksKey = domDataNextKey();

const CLEANABLE: Record<number, boolean> = { 1: true, 8: true, 9: true };
const CLEANABLE_WITH_DESCENDANTS: Record<number, boolean> = { 1: true, 9: true };

function getCallbacks(node: Node, create: true): DisposeCallback[];
function getCallbacks(node: Node, create: false): DisposeCallback[] | undefined;
function getCallbacks(node: Node, create: boolean): DisposeCallback[] | undefined {
  let callbacks = domDataGet(node, disposeCallbacksKey) as DisposeCallback[] | undefined;
  if (!callbacks && create) {
    callbacks = [];
    domDataSet(node, disposeCallbacksKey, callbacks);
  }
  return callbacks;
}

function destroyCallbacks(node: Node): void {
  domDataSet(node, disposeCallbacksKey, undefined);
}

function cleanSingleNode(node: Node): void {
  const callbacks = getCallbacks(node, false);
  if (callbacks) {
    const snapshot = callbacks.slice(0);
    for (let i = 0; i < snapshot.length; i++) {
      snapshot[i](node);
    }
  }

  domDataClear(node);

  if (CLEANABLE_WITH_DESCENDANTS[node.nodeType]) {
    cleanNodesInList(node.childNodes, true);
  }
}

function cleanNodesInList(nodeList: ArrayLike<Node>, onlyComments?: boolean): void {
  const cleaned: Node[] = [];
  let lastCleaned: Node;
  for (let i = 0; i < nodeList.length; i++) {
    if (!onlyComments || nodeList[i].nodeType === 8) {
      cleanSingleNode(cleaned[cleaned.length] = lastCleaned = nodeList[i]);
      if (nodeList[i] !== lastCleaned) {
        while (i-- && cleaned.indexOf(nodeList[i]) === -1) { /* adjust index */ }
      }
    }
  }
}

export function addDisposeCallback(node: Node, callback: DisposeCallback): void {
  if (typeof callback !== 'function') {
    throw new Error('Callback must be a function');
  }
  getCallbacks(node, true).push(callback);
}

export function removeDisposeCallback(node: Node, callback: DisposeCallback): void {
  const callbacks = getCallbacks(node, false);
  if (callbacks) {
    const index = callbacks.indexOf(callback);
    if (index >= 0) {
      callbacks.splice(index, 1);
      if (callbacks.length === 0) {
        destroyCallbacks(node);
      }
    }
  }
}

export function cleanNode(node: Node): Node {
  ignore(() => {
    if (CLEANABLE[node.nodeType]) {
      cleanSingleNode(node);

      if (CLEANABLE_WITH_DESCENDANTS[node.nodeType]) {
        const descendants = (node as Element).getElementsByTagName('*');
        cleanNodesInList(descendants);
      }
    }
  });
  return node;
}

export function removeNode(node: Node): void {
  cleanNode(node);
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}
