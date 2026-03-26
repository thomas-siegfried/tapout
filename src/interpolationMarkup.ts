import { addNodePreprocessor } from './bindingProvider.js';
import type { NodePreprocessFn } from './bindingProvider.js';
import { options } from './options.js';

// ---- Interpolation Parser ----

// Parses text containing {{ }} markup into alternating plain-text and expression segments.
// Uses a recursive inside-out approach: finds the outermost {{ and }} pair, then
// recursively parses the inner text to handle nested {{ }} correctly.
export function parseInterpolationMarkup(
  textToParse: string,
  outerTextCallback: (text: string) => void,
  expressionCallback: (expression: string) => void,
): void {
  function innerParse(text: string): void {
    const innerMatch = text.match(/^([\s\S]*)}}([\s\S]*?)\{\{([\s\S]*)$/);
    if (innerMatch) {
      innerParse(innerMatch[1]);
      outerTextCallback(innerMatch[2]);
      expressionCallback(innerMatch[3]);
    } else {
      expressionCallback(text);
    }
  }

  const outerMatch = textToParse.match(/^([\s\S]*?)\{\{([\s\S]*)}}([\s\S]*)$/);
  if (outerMatch) {
    outerTextCallback(outerMatch[1]);
    innerParse(outerMatch[2]);
    outerTextCallback(outerMatch[3]);
  }
}

function trim(s: string | null | undefined): string {
  return s == null ? '' : s.trim();
}

// ---- Expression → Comment Nodes ----

// Converts a parsed expression into comment-based binding nodes.
//   {{ expr }}        → <!-- tap text: expr --><!-- /tap -->
//   {{{ expr }}}      → <!-- tap html: expr --><!-- /tap -->
//   {{# if cond }}    → <!-- tap if: cond -->
//   {{# if cond /}}   → <!-- tap if: cond --><!-- /tap -->  (self-closing)
//   {{/ }}            → <!-- /tap -->
export function wrapExpression(expressionText: string, node?: Node): Node[] {
  const ownerDocument = node?.ownerDocument ?? document;
  let closeComment = true;
  let binding: string | undefined;
  expressionText = trim(expressionText);

  const firstChar = expressionText[0];
  const lastChar = expressionText[expressionText.length - 1];
  const result: Node[] = [];

  if (firstChar === '#') {
    if (lastChar === '/') {
      binding = trim(expressionText.slice(1, -1));
    } else {
      binding = trim(expressionText.slice(1));
      closeComment = false;
    }
    const matches = binding.match(/^([^,"'{}()\/:[\]\s]+)\s+([^\s:].*)/);
    if (matches) {
      binding = matches[1] + ':' + matches[2];
    }
  } else if (firstChar === '/') {
    // Closing tag — just emit the end comment
  } else if (firstChar === '{' && lastChar === '}') {
    binding = 'html:' + trim(expressionText.slice(1, -1));
  } else {
    binding = 'text:' + trim(expressionText);
  }

  if (binding) {
    result.push(ownerDocument.createComment(' tap ' + binding + ' '));
  }
  if (closeComment) {
    result.push(ownerDocument.createComment(' /tap '));
  }

  return result;
}

// ---- Node Preprocessor ----

export const interpolationMarkupPreprocessor: NodePreprocessFn = function (node: Node): Node[] | void {
  if (
    node.nodeType !== 3 ||
    !node.nodeValue ||
    node.nodeValue.indexOf('{{') === -1 ||
    (node.parentNode && (node.parentNode as Element).nodeName === 'TEXTAREA')
  ) {
    return;
  }

  const nodes: Node[] = [];

  function addTextNode(text: string): void {
    if (text) {
      nodes.push(node.ownerDocument!.createTextNode(text));
    }
  }

  function addExpressionNodes(expressionText: string): void {
    if (expressionText) {
      nodes.push(...wrapExpression(expressionText, node));
    }
  }

  parseInterpolationMarkup(node.nodeValue, addTextNode, addExpressionNodes);

  if (nodes.length) {
    if (node.parentNode) {
      const parent = node.parentNode;
      for (const newNode of nodes) {
        parent.insertBefore(newNode, node);
      }
      parent.removeChild(node);
    }
    return nodes;
  }
};

// ---- Enable ----

export function enableInterpolationMarkup(): void {
  options.interpolation = true;
  addNodePreprocessor(interpolationMarkupPreprocessor);
}
