import { parseObjectLiteral, preProcessBindings } from './expressionRewriting.js';
import type { KeyValuePair } from './expressionRewriting.js';
import { memoize } from './memoization.js';
import type { TemplateEngine } from './templateEngine.js';
import type { BindingContext } from './bindingContext.js';
import { applyBindingAccessorsToNode } from './applyBindings.js';

const memoizeDataBindingAttributeSyntaxRegex =
  /(<([a-z]+\d*)(?:\s+(?!data-bind\s*=\s*)[a-z0-9\-]+(?:=(?:"[^"]*"|'[^']*'|[^>]*))?)*\s+)data-bind\s*=\s*(["'])([\s\S]*?)\3/gi;

const memoizeVirtualContainerBindingSyntaxRegex =
  /<!--\s*tap\b\s*([\s\S]*?)\s*-->/g;

export const bindingRewriteValidators: Record<string, boolean | ((value: string) => string | void)> = {};

function validateDataBindValuesForRewriting(keyValueArray: KeyValuePair[]): void {
  for (const kv of keyValueArray) {
    const key = kv.key;
    if (key && Object.prototype.hasOwnProperty.call(bindingRewriteValidators, key)) {
      const validator = bindingRewriteValidators[key];
      if (typeof validator === 'function') {
        const msg = validator(kv.value || '');
        if (msg) throw new Error(msg);
      } else if (!validator) {
        throw new Error("This template engine does not support the '" + key + "' binding within its templates");
      }
    }
  }
}

function constructMemoizedTagReplacement(
  dataBindAttributeValue: string,
  tagToRetain: string,
  nodeName: string,
  templateEngine: TemplateEngine,
): string {
  const dataBindKeyValueArray = parseObjectLiteral(dataBindAttributeValue);
  validateDataBindValuesForRewriting(dataBindKeyValueArray);
  const rewrittenDataBindAttributeValue = preProcessBindings(dataBindKeyValueArray, { valueAccessors: true });

  const applyBindingsToNextSiblingScript =
    "tap.__tr_ambtns(function($context,$element){return(function(){return{ " +
    rewrittenDataBindAttributeValue +
    " } })()},'" + nodeName.toLowerCase() + "')";
  return templateEngine.createJavaScriptEvaluatorBlock(applyBindingsToNextSiblingScript) + tagToRetain;
}

export function ensureTemplateIsRewritten(
  template: string | Node,
  templateEngine: TemplateEngine,
  templateDocument?: Document,
): void {
  if (!templateEngine.isTemplateRewritten(template, templateDocument)) {
    templateEngine.rewriteTemplate(template, (htmlString) => {
      return memoizeBindingAttributeSyntax(htmlString, templateEngine);
    }, templateDocument);
  }
}

export function memoizeBindingAttributeSyntax(
  htmlString: string,
  templateEngine: TemplateEngine,
): string {
  return htmlString
    .replace(memoizeDataBindingAttributeSyntaxRegex, function () {
      return constructMemoizedTagReplacement(
        arguments[4], // dataBindAttributeValue
        arguments[1], // tagToRetain
        arguments[2], // nodeName
        templateEngine,
      );
    })
    .replace(memoizeVirtualContainerBindingSyntaxRegex, function () {
      return constructMemoizedTagReplacement(
        arguments[1],        // dataBindAttributeValue
        '<!-- tap -->',      // tagToRetain
        '#comment',          // nodeName
        templateEngine,
      );
    });
}

export function applyMemoizedBindingsToNextSibling(
  bindings: ((ctx: BindingContext, el: Node) => Record<string, () => unknown>),
  nodeName: string,
): string {
  return memoize(function (domNode: unknown, bindingContext: unknown) {
    const node = domNode as Node;
    const nodeToBind = node.nextSibling;
    if (nodeToBind && nodeToBind.nodeName.toLowerCase() === nodeName) {
      applyBindingAccessorsToNode(nodeToBind, bindings, bindingContext);
    }
  });
}
