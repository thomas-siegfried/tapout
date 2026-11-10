import { Computed } from './computed.js';
import { ignore } from './dependencyDetection.js';
import { addDisposeCallback } from './domNodeDisposal.js';
import { bindingEvent } from './bindingEvent.js';
import { BindingProvider, bindingHandlers, setCustomElementHooks, addNodePreprocessor } from './bindingProvider.js';
import type { BindingHandler } from './bindingProvider.js';
import { BindingContext } from './bindingContext.js';
import { applyBindingsToDescendants } from './applyBindings.js';
import {
  virtualChildNodes,
  virtualEmptyNode,
  virtualSetChildren,
  allowedVirtualElementBindings,
} from './virtualElements.js';
import { unwrapObservable } from './utils.js';
import { cloneNodes, SVG_NS } from './utilsDom.js';
import { isReadableSubscribable } from './subscribable.js';
import { Observable } from './observable.js';
import { parseObjectLiteral } from './expressionRewriting.js';
import { CONTEXT_KEYWORDS, resolveObservableRef } from './observableRefs.js';
import { wireParams } from './wireParams.js';
import { options } from './options.js';
import * as components from './components.js';
import type { ComponentDefinition, ComponentInfo } from './components.js';

let componentLoadingOperationUniqueId = 0;

function cloneTemplateIntoElement(
  componentName: string,
  componentDefinition: ComponentDefinition,
  element: Node,
): void {
  const template = componentDefinition.template;
  if (!template) {
    throw new Error("Component '" + componentName + "' has no template");
  }
  const clonedNodesArray = cloneNodes(template);
  virtualSetChildren(element, clonedNodesArray);
}

function createViewModel(
  componentDefinition: ComponentDefinition,
  componentParams: unknown,
  componentInfo: ComponentInfo,
): unknown {
  const factory = componentDefinition.createViewModel;
  return factory
    ? factory.call(componentDefinition, componentParams, componentInfo)
    : componentParams;
}

const componentHandler: BindingHandler = {
  init(element, valueAccessor, _allBindings, _viewModel, bindingContext) {
    let currentViewModel: unknown;
    let currentLoadingOperationId: number | null;
    let afterRenderSub: { dispose(): void } | null = null;

    function disposeAssociatedComponentViewModel() {
      const vm = currentViewModel as { dispose?: () => void } | null;
      if (typeof vm?.dispose === 'function') {
        vm.dispose();
      }
      if (afterRenderSub) {
        afterRenderSub.dispose();
      }
      afterRenderSub = null;
      currentViewModel = null;
      currentLoadingOperationId = null;
    }

    const originalChildNodes = Array.from(virtualChildNodes(element));

    virtualEmptyNode(element);
    addDisposeCallback(element, disposeAssociatedComponentViewModel);

    const computed = new Computed(() => {
      const value = unwrapObservable(valueAccessor());
      let componentName: string;
      let componentParams: unknown;

      if (typeof value === 'string') {
        componentName = value;
      } else {
        const obj = value as { name: unknown; params?: unknown };
        componentName = unwrapObservable(obj.name) as string;
        componentParams = unwrapObservable(obj.params);
      }

      if (!componentName) {
        throw new Error('No component name specified');
      }

      const asyncContext = bindingEvent.startPossiblyAsyncContentBinding(element, bindingContext);

      const loadingOperationId = currentLoadingOperationId = ++componentLoadingOperationUniqueId;

      components.get(componentName, (componentDefinition) => {
        if (currentLoadingOperationId !== loadingOperationId) {
          return;
        }

        disposeAssociatedComponentViewModel();

        if (!componentDefinition) {
          throw new Error("Unknown component '" + componentName + "'");
        }

        cloneTemplateIntoElement(componentName, componentDefinition, element);

        const componentInfo: ComponentInfo = {
          element,
          templateNodes: originalChildNodes,
        };

        const componentViewModel = createViewModel(componentDefinition, componentParams, componentInfo);

        if (componentViewModel && componentViewModel !== componentParams &&
            typeof componentParams === 'object' && componentParams !== null) {
          wireParams(componentViewModel as object, componentParams as Record<string, unknown>, element);
        }

        if (componentViewModel && typeof (componentViewModel as Record<string, unknown>).onInit === 'function') {
          ((componentViewModel as Record<string, unknown>).onInit as () => void)();
        }

        const childBindingContext = asyncContext.createChildContext(componentViewModel, {
          extend(ctx: BindingContext) {
            ctx['$component'] = componentViewModel;
            ctx['$componentTemplateNodes'] = originalChildNodes;
          },
        });

        if (componentViewModel && typeof (componentViewModel as Record<string, unknown>).onDescendantsComplete === 'function') {
          afterRenderSub = bindingEvent.subscribe(
            element,
            bindingEvent.descendantsComplete,
            (componentViewModel as Record<string, unknown>).onDescendantsComplete as (value: unknown) => void,
            componentViewModel,
          );
        }

        currentViewModel = componentViewModel;
        ignore(() => applyBindingsToDescendants(childBindingContext, element));
      });
    });

    addDisposeCallback(element, () => computed.dispose());

    return { controlsDescendantBindings: true };
  },
};

bindingHandlers['component'] = componentHandler;
allowedVirtualElementBindings['component'] = true;

// ---- Custom Element Bridge ----

// Marks a <g> host that replaced a custom element inside SVG (see the node preprocessor below).
const COMPONENT_ATTR = 'data-tap-component';

export function getComponentNameForNode(node: Node): string | undefined {
  if (node.nodeType !== 1) return undefined;
  const tagNameLower = ((node as Element).tagName || '').toLowerCase();
  if (components.isRegistered(tagNameLower)
      && (tagNameLower.indexOf('-') !== -1 || ('' + node) === '[object HTMLUnknownElement]')) {
    return tagNameLower;
  }
  const marked = (node as Element).getAttribute?.(COMPONENT_ATTR);
  if (marked && components.isRegistered(marked)) return marked;
  return undefined;
}

function isWritable(value: unknown): boolean {
  if (value instanceof Observable) return true;
  if (value instanceof Computed) return (value as Computed<unknown>).hasWriteFunction;
  return false;
}

const nativeProviderInstance = new BindingProvider();

const OBSERVABLE_REF_PATTERN = /^\$([a-zA-Z_$][\w$]*)$/;

function getComponentParamsFromCustomElement(
  elem: Element,
  bindingContext: BindingContext,
): Record<string, unknown> {
  const paramsAttribute = elem.getAttribute('params');

  if (paramsAttribute) {
    const keyValuePairs = parseObjectLiteral(paramsAttribute);
    const observableRefParams: Record<string, string> = {};
    const normalPairs: string[] = [];

    for (const kv of keyValuePairs) {
      const key = kv.key || kv.unknown || '';
      const val = (kv.value || '').trim();
      const match = val.match(OBSERVABLE_REF_PATTERN);

      if (match && !CONTEXT_KEYWORDS.has(val)) {
        observableRefParams[key] = match[1];
      } else if (key) {
        normalPairs.push(key + ':' + (kv.value || ''));
      }
    }

    const result: Record<string, unknown> = {};
    const rawParamComputedValues: Record<string, Computed<unknown>> = {};

    if (normalPairs.length > 0) {
      const normalParamsString = normalPairs.join(',');
      const params = nativeProviderInstance.parseBindingsString(
        normalParamsString,
        bindingContext,
        elem,
        { valueAccessors: true },
      ) as Record<string, () => unknown> | null;

      if (params) {
        for (const paramName of Object.keys(params)) {
          rawParamComputedValues[paramName] = new Computed(
            params[paramName] as () => unknown,
          );
          addDisposeCallback(elem, () => rawParamComputedValues[paramName].dispose());
        }

        for (const paramName of Object.keys(rawParamComputedValues)) {
          const paramValueComputed = rawParamComputedValues[paramName];
          const paramValue = paramValueComputed.peek();

          if (!paramValueComputed.isActive()) {
            result[paramName] = paramValue;
          } else {
            result[paramName] = new Computed({
              read() {
                return unwrapObservable(paramValueComputed.get());
              },
              write: isWritable(paramValue)
                ? (value: unknown) => {
                    const currentObs = paramValueComputed.get();
                    if (currentObs instanceof Observable) {
                      currentObs.set(value);
                    } else if (currentObs instanceof Computed && (currentObs as Computed<unknown>).hasWriteFunction) {
                      (currentObs as Computed<unknown>).set(value);
                    }
                  }
                : undefined,
            });
            addDisposeCallback(elem, () => (result[paramName] as Computed<unknown>).dispose());
          }
        }
      }
    }

    for (const [key, propName] of Object.entries(observableRefParams)) {
      const dataContext = bindingContext.$data;
      if (dataContext && typeof dataContext === 'object') {
        result[key] = resolveObservableRef(dataContext, propName);
      }
    }

    if (!Object.prototype.hasOwnProperty.call(result, '$raw')) {
      result['$raw'] = rawParamComputedValues;
    }

    return result;
  }

  return { $raw: {} };
}

export function addBindingsForCustomElement(
  allBindings: Record<string, unknown> | null,
  node: Node,
  bindingContext: BindingContext,
  valueAccessors?: boolean,
): Record<string, unknown> | null {
  if (node.nodeType === 1) {
    const componentName = getComponentNameForNode(node);
    if (componentName) {
      allBindings = allBindings || {};

      if (allBindings['component']) {
        throw new Error('Cannot use the "component" binding on a custom element matching a component');
      }

      const componentBindingValue = {
        name: componentName,
        params: getComponentParamsFromCustomElement(node as Element, bindingContext),
      };

      allBindings['component'] = valueAccessors
        ? () => componentBindingValue
        : componentBindingValue;
    }
  }

  return allBindings;
}

// Register hooks on the binding provider to enable custom element detection
setCustomElementHooks(getComponentNameForNode, addBindingsForCustomElement);

// Custom element preprocessing, branching on namespace:
// - SVG: browsers never render unknown SVG elements (or their descendants), and display:contents
//   has no effect on them. A registered component tag is replaced with a <g> host carrying the
//   COMPONENT_ATTR marker, so it stays on the custom-element path (params, $name refs, etc.).
//   Disable via options.svgCustomElements.
// - HTML: apply display:contents so the element doesn't affect layout. Opt out per-element with the
//   "layout" attribute, or globally via options.customElementDisplayContents.
addNodePreprocessor((node: Node): Node[] | void => {
  if (node.nodeType !== 1 || !node.nodeName.includes('-')) return;
  const el = node as Element;

  if (el.namespaceURI === SVG_NS) {
    if (!options.svgCustomElements) return;
    const name = el.localName;
    if (!components.isRegistered(name)) return;

    const host = el.ownerDocument.createElementNS(SVG_NS, 'g');
    for (const attr of Array.from(el.attributes)) {
      host.setAttributeNS(attr.namespaceURI, attr.name, attr.value);
    }
    host.setAttribute(COMPONENT_ATTR, name);
    while (el.firstChild) host.appendChild(el.firstChild);
    el.replaceWith(host);
    return [host];
  }

  if (!options.customElementDisplayContents) return;
  if (!el.hasAttribute('layout')) {
    (el as HTMLElement).style.display = 'contents';
  }
});
