import { domDataGet, domDataSet } from './domData.js';
import { removeNode } from './domNodeDisposal.js';

const startCommentRegex = /^\s*tap(?:\s+([\s\S]+))?\s*$/;
const endCommentRegex = /^\s*\/tap\s*$/;
const matchedEndCommentDataKey = '__tap_matchedEndComment__';

export const allowedVirtualElementBindings: Record<string, boolean> = {};

export function isStartComment(node: Node): boolean {
  return node.nodeType === 8 && startCommentRegex.test(node.nodeValue || '');
}

function isEndComment(node: Node): boolean {
  return node.nodeType === 8 && endCommentRegex.test(node.nodeValue || '');
}

function isUnmatchedEndComment(node: Node): boolean {
  return isEndComment(node) && !domDataGet(node, matchedEndCommentDataKey);
}

function getVirtualChildren(startComment: Node, allowUnbalanced?: boolean): Node[] | null {
  let currentNode = startComment.nextSibling;
  let depth = 1;
  const children: Node[] = [];
  while (currentNode) {
    if (isEndComment(currentNode)) {
      domDataSet(currentNode, matchedEndCommentDataKey, true);
      depth--;
      if (depth === 0) return children;
    }
    children.push(currentNode);
    if (isStartComment(currentNode)) depth++;
    currentNode = currentNode.nextSibling;
  }
  if (!allowUnbalanced) {
    throw new Error('Cannot find closing comment tag to match: ' + startComment.nodeValue);
  }
  return null;
}

function getMatchingEndComment(startComment: Node, allowUnbalanced?: boolean): Node | null {
  const allVirtualChildren = getVirtualChildren(startComment, allowUnbalanced);
  if (allVirtualChildren) {
    if (allVirtualChildren.length > 0) {
      return allVirtualChildren[allVirtualChildren.length - 1].nextSibling;
    }
    return startComment.nextSibling;
  }
  return null;
}

export function virtualChildNodes(node: Node): Node[] | NodeListOf<ChildNode> {
  return isStartComment(node) ? getVirtualChildren(node)! : node.childNodes;
}

export function virtualEmptyNode(node: Node): void {
  if (!isStartComment(node)) {
    while (node.firstChild) {
      removeNode(node.firstChild);
    }
  } else {
    const children = getVirtualChildren(node)!;
    for (let i = 0; i < children.length; i++) {
      removeNode(children[i]);
    }
  }
}

export function virtualSetChildren(node: Node, childNodes: Node[]): void {
  if (!isStartComment(node)) {
    while (node.firstChild) {
      removeNode(node.firstChild);
    }
    for (let i = 0; i < childNodes.length; i++) {
      node.appendChild(childNodes[i]);
    }
  } else {
    virtualEmptyNode(node);
    const endCommentNode = node.nextSibling!;
    for (let i = 0; i < childNodes.length; i++) {
      endCommentNode.parentNode!.insertBefore(childNodes[i], endCommentNode);
    }
  }
}

export function virtualPrepend(containerNode: Node, nodeToPrepend: Node): void {
  let insertBeforeNode: Node | null;
  let parent: Node;

  if (isStartComment(containerNode)) {
    insertBeforeNode = containerNode.nextSibling;
    parent = containerNode.parentNode!;
  } else {
    insertBeforeNode = containerNode.firstChild;
    parent = containerNode;
  }

  if (!insertBeforeNode) {
    parent.appendChild(nodeToPrepend);
  } else {
    parent.insertBefore(nodeToPrepend, insertBeforeNode);
  }
}

export function virtualInsertAfter(containerNode: Node, nodeToInsert: Node, insertAfterNode: Node | null): void {
  if (!insertAfterNode) {
    virtualPrepend(containerNode, nodeToInsert);
    return;
  }

  const insertBeforeNode = insertAfterNode.nextSibling;
  const parent = isStartComment(containerNode) ? containerNode.parentNode! : containerNode;

  if (!insertBeforeNode) {
    parent.appendChild(nodeToInsert);
  } else {
    parent.insertBefore(nodeToInsert, insertBeforeNode);
  }
}

export function virtualFirstChild(node: Node): Node | null {
  if (!isStartComment(node)) {
    const first = node.firstChild;
    if (first && isEndComment(first)) {
      return first.nextSibling;
    }
    return first;
  }
  if (!node.nextSibling || isEndComment(node.nextSibling)) {
    return null;
  }
  return node.nextSibling;
}

export function virtualNextSibling(node: Node): Node | null {
  if (isStartComment(node)) {
    node = getMatchingEndComment(node)!;
  }
  if (node.nextSibling && isEndComment(node.nextSibling)) {
    return null;
  }
  return node.nextSibling;
}

export function hasBindingValue(node: Node): boolean {
  return isStartComment(node);
}

export function virtualNodeBindingValue(node: Node): string | null {
  const match = (node.nodeValue || '').match(startCommentRegex);
  return match ? match[1]?.trim() ?? null : null;
}
