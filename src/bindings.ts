import { unwrapObservable } from './utils.js';
import { bindingHandlers } from './bindingProvider.js';
import type { BindingHandler } from './bindingProvider.js';
import { allowedVirtualElementBindings, virtualFirstChild, virtualNextSibling, virtualSetChildren } from './virtualElements.js';
import { removeNode } from './domNodeDisposal.js';

// ---- Shared DOM Utilities ----

function setTextContent(element: Node, textContent: unknown): void {
  let value = unwrapObservable(textContent);
  if (value === null || value === undefined) value = '';

  const innerTextNode = virtualFirstChild(element);
  if (!innerTextNode || innerTextNode.nodeType !== 3 || virtualNextSibling(innerTextNode)) {
    const doc = (element as Element).ownerDocument ?? (element as Document);
    virtualSetChildren(element, [doc.createTextNode(String(value))]);
  } else {
    (innerTextNode as Text).data = String(value);
  }
}

function emptyDomNode(node: Node): void {
  while (node.firstChild) {
    removeNode(node.firstChild);
  }
}

function setHtml(node: Node, html: unknown): void {
  emptyDomNode(node);
  html = unwrapObservable(html);
  if (html === null || html === undefined) return;

  const htmlString = typeof html === 'string' ? html : String(html);
  const el = node as Element;
  el.innerHTML = htmlString;
}

const CSS_CLASS_REGEX = /\S+/g;
const CLASSES_WRITTEN_KEY = '__tapout__cssValue';

function toggleDomNodeCssClass(node: Element, classNames: string | null | undefined, shouldHaveClass: boolean): void {
  if (!classNames) return;

  const matches = classNames.match(CSS_CLASS_REGEX);
  if (!matches) return;

  if (typeof node.classList === 'object') {
    const fn = shouldHaveClass ? 'add' : 'remove';
    for (const cls of matches) {
      node.classList[fn](cls);
    }
  } else if (typeof (node.className as unknown as { baseVal?: string })?.baseVal === 'string') {
    // SVG element
    toggleClassPropertyString(node.className as unknown as { baseVal: string }, 'baseVal', matches, shouldHaveClass);
  } else {
    toggleClassPropertyString(node as unknown as Record<string, string>, 'className', matches, shouldHaveClass);
  }
}

function toggleClassPropertyString(
  obj: Record<string, string>,
  prop: string,
  classNames: string[],
  shouldHaveClass: boolean,
): void {
  const current: string[] = (obj[prop] || '').match(CSS_CLASS_REGEX)?.slice() ?? [];
  for (const cls of classNames) {
    const idx = current.indexOf(cls);
    if (shouldHaveClass && idx === -1) {
      current.push(cls);
    } else if (!shouldHaveClass && idx !== -1) {
      current.splice(idx, 1);
    }
  }
  obj[prop] = current.join(' ');
}

function setElementName(element: Element, name: string): void {
  (element as HTMLInputElement).name = name;
}

// ---- Task 17: One-way display bindings ----

const textHandler: BindingHandler = {
  init() {
    return { controlsDescendantBindings: true };
  },
  update(node, valueAccessor) {
    setTextContent(node, valueAccessor());
  },
};

const htmlHandler: BindingHandler = {
  init() {
    return { controlsDescendantBindings: true };
  },
  update(node, valueAccessor) {
    setHtml(node, valueAccessor());
  },
};

const visibleHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as HTMLElement;
    const value = unwrapObservable(valueAccessor());
    const isCurrentlyVisible = el.style.display !== 'none';
    if (value && !isCurrentlyVisible) {
      el.style.display = '';
    } else if (!value && isCurrentlyVisible) {
      el.style.display = 'none';
    }
  },
};

const hiddenHandler: BindingHandler = {
  update(node, valueAccessor) {
    visibleHandler.update!(node, () => !unwrapObservable(valueAccessor()), {} as never, undefined, {} as never);
  },
};

// ---- Task 18: Attribute bindings ----

const attrHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as Element;
    const value = unwrapObservable(valueAccessor()) as Record<string, unknown> | null;
    if (!value) return;

    for (const attrName of Object.keys(value)) {
      let attrValue = unwrapObservable(value[attrName]);

      const prefixLen = attrName.indexOf(':');
      const namespace = 'lookupNamespaceURI' in el && prefixLen > 0
        ? (el as Element).lookupNamespaceURI(attrName.substring(0, prefixLen))
        : null;

      const toRemove = attrValue === false || attrValue === null || attrValue === undefined;

      if (toRemove) {
        namespace
          ? el.removeAttributeNS(namespace, attrName)
          : el.removeAttribute(attrName);
      } else {
        const strValue = String(attrValue);
        namespace
          ? el.setAttributeNS(namespace, attrName, strValue)
          : el.setAttribute(attrName, strValue);
      }

      if (attrName === 'name') {
        setElementName(el, toRemove ? '' : String(attrValue));
      }
    }
  },
};

const classHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as Element;
    const value = String(unwrapObservable(valueAccessor()) ?? '').trim();
    const previousValue = (el as unknown as Record<string, string>)[CLASSES_WRITTEN_KEY];
    toggleDomNodeCssClass(el, previousValue, false);
    (el as unknown as Record<string, string>)[CLASSES_WRITTEN_KEY] = value;
    toggleDomNodeCssClass(el, value, true);
  },
};

const cssHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as Element;
    const value = unwrapObservable(valueAccessor());
    if (value !== null && typeof value === 'object') {
      for (const className of Object.keys(value as Record<string, unknown>)) {
        const shouldHaveClass = !!unwrapObservable((value as Record<string, unknown>)[className]);
        toggleDomNodeCssClass(el, className, shouldHaveClass);
      }
    } else {
      classHandler.update!(node, valueAccessor, {} as never, undefined, {} as never);
    }
  },
};

const styleHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as HTMLElement;
    const value = unwrapObservable(valueAccessor() || {}) as Record<string, unknown>;

    for (const styleName of Object.keys(value)) {
      let styleValue = unwrapObservable(value[styleName]);

      if (styleValue === null || styleValue === undefined || styleValue === false) {
        styleValue = '';
      }

      if (/^--/.test(styleName)) {
        el.style.setProperty(styleName, String(styleValue));
      } else {
        const camelCased = styleName.replace(/-(\w)/g, (_all, letter: string) => letter.toUpperCase());

        const previousStyle = (el.style as unknown as Record<string, string>)[camelCased];
        (el.style as unknown as Record<string, string>)[camelCased] = String(styleValue);

        if (
          String(styleValue) !== previousStyle &&
          (el.style as unknown as Record<string, string>)[camelCased] === previousStyle &&
          !isNaN(styleValue as number)
        ) {
          (el.style as unknown as Record<string, string>)[camelCased] = styleValue + 'px';
        }
      }
    }
  },
};

// ---- Task 19: Form state bindings ----

const enableHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as HTMLElement;
    const value = unwrapObservable(valueAccessor());
    if (value && (el as HTMLInputElement).disabled) {
      el.removeAttribute('disabled');
    } else if (!value && !(el as HTMLInputElement).disabled) {
      (el as HTMLInputElement).disabled = true;
    }
  },
};

const disableHandler: BindingHandler = {
  update(node, valueAccessor) {
    enableHandler.update!(node, () => !unwrapObservable(valueAccessor()), {} as never, undefined, {} as never);
  },
};

let uniqueNameIndex = 0;

const uniqueNameHandler: BindingHandler = {
  init(node, valueAccessor) {
    if (valueAccessor()) {
      const name = 'tap_unique_' + (++uniqueNameIndex);
      setElementName(node as Element, name);
    }
  },
};

// ---- Registration ----

bindingHandlers['text'] = textHandler;
bindingHandlers['html'] = htmlHandler;
bindingHandlers['visible'] = visibleHandler;
bindingHandlers['hidden'] = hiddenHandler;
bindingHandlers['attr'] = attrHandler;
bindingHandlers['class'] = classHandler;
bindingHandlers['css'] = cssHandler;
bindingHandlers['style'] = styleHandler;
bindingHandlers['enable'] = enableHandler;
bindingHandlers['disable'] = disableHandler;
bindingHandlers['uniqueName'] = uniqueNameHandler;

allowedVirtualElementBindings['text'] = true;
