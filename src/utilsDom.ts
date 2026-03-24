import { cleanNode, removeNode } from './domNodeDisposal.js';

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
