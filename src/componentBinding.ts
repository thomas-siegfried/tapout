import { Computed } from './computed.js';
import { ignore } from './dependencyDetection.js';
import { addDisposeCallback } from './domNodeDisposal.js';
import { bindingEvent } from './bindingEvent.js';
import { BindingProvider, bindingHandlers, setCustomElementHooks } from './bindingProvider.js';
import type { BindingHandler } from './bindingProvider.js';
import { BindingContext } from './bindingContext.js';
import { applyBindingsToDescendants } from './applyBindings.js';
import {
  virtualChildNodes,
  virtualEmptyNode,
  virtualSetChildren,
  allowedVirtualElementBindings,
} from './virtualElements.js';
import { cloneNodes, unwrapObservable } from './utils.js';
import { isReadableSubscribable } from './subscribable.js';
import { Observable } from './observable.js';
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
        const childBindingContext = asyncContext.createChildContext(componentViewModel, {
          extend(ctx: BindingContext) {
            ctx['$component'] = componentViewModel;
            ctx['$componentTemplateNodes'] = originalChildNodes;
          },
        });

        if (componentViewModel && typeof (componentViewModel as Record<string, unknown>).koDescendantsComplete === 'function') {
          afterRenderSub = bindingEvent.subscribe(
            element,
            bindingEvent.descendantsComplete,
            (componentViewModel as Record<string, unknown>).koDescendantsComplete as (value: unknown) => void,
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

export function getComponentNameForNode(node: Node): string | undefined {
  if (node.nodeType !== 1) return undefined;
  const tagNameLower = ((node as Element).tagName || '').toLowerCase();
  if (!components.isRegistered(tagNameLower)) return undefined;
  if (tagNameLower.indexOf('-') !== -1 || ('' + node) === '[object HTMLUnknownElement]') {
    return tagNameLower;
  }
  return undefined;
}

function isWritable(value: unknown): boolean {
  if (value instanceof Observable) return true;
  if (value instanceof Computed) return (value as Computed<unknown>).hasWriteFunction;
  return false;
}

const nativeProviderInstance = new BindingProvider();

function getComponentParamsFromCustomElement(
  elem: Element,
  bindingContext: BindingContext,
): Record<string, unknown> {
  const paramsAttribute = elem.getAttribute('params');

  if (paramsAttribute) {
    const params = nativeProviderInstance.parseBindingsString(
      paramsAttribute,
      bindingContext,
      elem,
      { valueAccessors: true },
    ) as Record<string, () => unknown> | null;

    if (!params) return { $raw: {} };

    const rawParamComputedValues: Record<string, Computed<unknown>> = {};
    for (const paramName of Object.keys(params)) {
      rawParamComputedValues[paramName] = new Computed(
        params[paramName] as () => unknown,
      );
      addDisposeCallback(elem, () => rawParamComputedValues[paramName].dispose());
    }

    const result: Record<string, unknown> = {};
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
