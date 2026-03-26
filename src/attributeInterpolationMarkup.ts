import { addNodePreprocessor, getBindingHandler } from './bindingProvider.js';
import type { NodePreprocessFn } from './bindingProvider.js';
import { options } from './options.js';
import { parseInterpolationMarkup } from './interpolationMarkup.js';

const DATA_BIND_ATTR = 'data-bind';

// Determines the binding expression for an attribute.
// If a binding handler exists for the attribute name, use it directly.
// Otherwise, fall back to `attr.name` (namespaced binding syntax).
export function attributeBinding(
  name: string,
  value: string,
  _node: Element,
): string {
  if (getBindingHandler(name)) {
    return name + ':' + value;
  } else {
    return 'attr.' + name + ':' + value;
  }
}

// Customizable hook — override to change how attribute names map to bindings.
let _attributeBindingFn = attributeBinding;

export function setAttributeBinding(
  fn: (name: string, value: string, node: Element) => string,
): void {
  _attributeBindingFn = fn;
}

export const attributeInterpolationMarkupPreprocessor: NodePreprocessFn = function (node: Node): void {
  if (node.nodeType !== 1 || !(node as Element).attributes?.length) return;

  const element = node as Element;
  let dataBindAttribute = element.getAttribute(DATA_BIND_ATTR);

  const attrs: Attr[] = [];
  for (let i = 0; i < element.attributes.length; i++) {
    attrs.push(element.attributes[i]);
  }

  for (const attr of attrs) {
    if (
      attr.specified !== false &&
      attr.name !== DATA_BIND_ATTR &&
      attr.value.indexOf('{{') !== -1
    ) {
      const parts: string[] = [];
      let attrValue = '';

      function addText(text: string): void {
        if (text) {
          parts.push('"' + text.replace(/"/g, '\\"') + '"');
        }
      }

      function addExpr(expressionText: string): void {
        if (expressionText) {
          attrValue = expressionText;
          parts.push('$unwrap(' + expressionText + ')');
        }
      }

      parseInterpolationMarkup(attr.value, addText, addExpr);

      if (parts.length > 1) {
        attrValue = '""+' + parts.join('+');
      }

      if (attrValue) {
        const attrName = attr.name.toLowerCase();
        const binding = _attributeBindingFn(attrName, attrValue, element);

        if (!dataBindAttribute) {
          dataBindAttribute = binding;
        } else {
          dataBindAttribute += ',' + binding;
        }

        element.setAttribute(DATA_BIND_ATTR, dataBindAttribute);
        element.removeAttribute(attr.name);
      }
    }
  }
};

export function enableAttributeInterpolationMarkup(): void {
  options.attributeInterpolation = true;
  addNodePreprocessor(attributeInterpolationMarkupPreprocessor);
}
