type MemoCallback = (...args: unknown[]) => void;

const memos = new Map<string, MemoCallback>();

function randomMax8HexChars(): string {
  return (((1 + Math.random()) * 0x100000000) | 0).toString(16).substring(1);
}

function generateRandomId(): string {
  return randomMax8HexChars() + randomMax8HexChars();
}

function findMemoNodes(
  rootNode: Node | null,
  appendToArray: { domNode: Comment; memoId: string }[],
): void {
  if (!rootNode) return;
  if (rootNode.nodeType === 8) {
    const memoId = parseMemoText(rootNode.nodeValue || '');
    if (memoId != null)
      appendToArray.push({ domNode: rootNode as Comment, memoId });
  } else if (rootNode.nodeType === 1) {
    const childNodes = rootNode.childNodes;
    for (let i = 0; i < childNodes.length; i++)
      findMemoNodes(childNodes[i], appendToArray);
  }
}

export function memoize(callback: MemoCallback): string {
  if (typeof callback !== 'function')
    throw new Error('You can only pass a function to memoize()');
  const memoId = generateRandomId();
  memos.set(memoId, callback);
  return '<!--[tap_memo:' + memoId + ']-->';
}

export function unmemoize(memoId: string, callbackParams?: unknown[]): boolean {
  const callback = memos.get(memoId);
  if (callback === undefined)
    throw new Error("Couldn't find any memo with ID " + memoId + ". Perhaps it's already been unmemoized.");
  try {
    callback.apply(null, callbackParams || []);
    return true;
  } finally {
    memos.delete(memoId);
  }
}

export function unmemoizeDomNodeAndDescendants(
  domNode: Node,
  extraCallbackParamsArray?: unknown[],
): void {
  const found: { domNode: Comment; memoId: string }[] = [];
  findMemoNodes(domNode, found);
  for (const { domNode: node, memoId } of found) {
    const combinedParams: unknown[] = [node];
    if (extraCallbackParamsArray)
      combinedParams.push(...extraCallbackParamsArray);
    unmemoize(memoId, combinedParams);
    node.nodeValue = '';
    if (node.parentNode)
      node.parentNode.removeChild(node);
  }
}

const memoTextRegex = /^\[tap_memo:(.*?)\]$/;

export function parseMemoText(memoText: string): string | null {
  const match = memoText.match(memoTextRegex);
  return match ? match[1] : null;
}
