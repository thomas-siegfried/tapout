import { Computed } from './computed.js';
import type { BindingHandler } from './bindingProvider.js';
import type { AllBindingsAccessor } from './expressionRewriting.js';
import type { CreateChildContextOptions, BindingContextOptions } from './bindingContext.js';
import { bindingHandlers } from './bindingProvider.js';
import { BindingContext } from './bindingContext.js';
import { applyBindingsToDescendants } from './applyBindings.js';
import { addDisposeCallback } from './domNodeDisposal.js';
import { getDependenciesCount, getCurrentComputed } from './dependencyDetection.js';
import { bindingEvent } from './bindingEvent.js';
import { nativeTemplateEngine } from './templateEngine.js';
import {
  allowedVirtualElementBindings,
  virtualChildNodes,
  virtualEmptyNode,
  virtualSetChildren,
} from './virtualElements.js';
import { unwrapObservable } from './utils.js';
import { cloneNodes } from './utilsDom.js';

// ---- if / ifnot / with ----

function makeWithIfBinding(
  bindingKey: string,
  isWith?: boolean,
  isNot?: boolean,
): void {
  const handler: BindingHandler = {
    init(element, valueAccessor, allBindings, _viewModel, bindingContext) {
      let didDisplayOnLastUpdate: boolean | undefined;
      let savedNodes: Node[] | undefined;
      let completeOnRender: boolean;
      let needAsyncContext: boolean;
      let renderOnEveryChange: boolean | undefined;

      const contextOptions: Record<string, unknown> = {};

      if (isWith) {
        const as = (allBindings as AllBindingsAccessor).get('as') as string | undefined;
        const noChildContext = (allBindings as AllBindingsAccessor).get('noChildContext') as boolean | undefined;
        renderOnEveryChange = !(as && noChildContext);
        contextOptions.as = as;
        contextOptions.noChildContext = noChildContext;
        contextOptions.exportDependencies = renderOnEveryChange;
      }

      completeOnRender = (allBindings as AllBindingsAccessor).get('completeOn') === 'render';
      needAsyncContext = completeOnRender || (allBindings as AllBindingsAccessor).has(bindingEvent.descendantsComplete);

      const computed = new Computed(() => {
        const value = unwrapObservable(valueAccessor());
        const shouldDisplay = !isNot !== !value;
        const isInitial = !savedNodes;
        let childContext: BindingContext | undefined;

        if (!renderOnEveryChange && shouldDisplay === didDisplayOnLastUpdate) {
          return;
        }

        let currentBindingContext = bindingContext!;
        if (needAsyncContext) {
          currentBindingContext = bindingEvent.startPossiblyAsyncContentBinding(element, currentBindingContext);
        }

        if (shouldDisplay) {
          if (!isWith || renderOnEveryChange) {
            const currentComputed = getCurrentComputed();
            if (currentComputed) {
              contextOptions.dataDependency = currentComputed as unknown as Computed<unknown>;
            }
          }

          if (isWith) {
            childContext = currentBindingContext.createChildContext(
              typeof value === 'function' ? value : valueAccessor,
              contextOptions as CreateChildContextOptions,
            );
          } else if (getDependenciesCount()) {
            childContext = currentBindingContext.extend(null, contextOptions as BindingContextOptions);
          } else {
            childContext = currentBindingContext;
          }
        }

        if (isInitial && getDependenciesCount()) {
          savedNodes = cloneNodes(Array.from(virtualChildNodes(element)), true);
        }

        if (shouldDisplay) {
          if (!isInitial) {
            virtualSetChildren(element, cloneNodes(savedNodes!));
          }
          applyBindingsToDescendants(childContext!, element);
        } else {
          virtualEmptyNode(element);
          if (!completeOnRender) {
            bindingEvent.notify(element, bindingEvent.childrenComplete);
          }
        }

        didDisplayOnLastUpdate = shouldDisplay;
      });

      addDisposeCallback(element, () => computed.dispose());

      return { controlsDescendantBindings: true };
    },
  };

  bindingHandlers[bindingKey] = handler;
  allowedVirtualElementBindings[bindingKey] = true;
}

makeWithIfBinding('if');
makeWithIfBinding('ifnot', false, true);
makeWithIfBinding('with', true);

// ---- let ----

const letHandler: BindingHandler = {
  init(element, valueAccessor, _allBindings, _viewModel, bindingContext) {
    const innerContext = bindingContext!.extend(
      valueAccessor as () => Record<string, unknown>,
    );
    applyBindingsToDescendants(innerContext, element);
    return { controlsDescendantBindings: true };
  },
};

bindingHandlers['let'] = letHandler;
allowedVirtualElementBindings['let'] = true;

// ---- using ----

const usingHandler: BindingHandler = {
  init(element, valueAccessor, allBindings, _viewModel, bindingContext) {
    let options: { as?: string; noChildContext?: boolean } | undefined;
    if ((allBindings as AllBindingsAccessor).has('as')) {
      options = {
        as: (allBindings as AllBindingsAccessor).get('as') as string,
        noChildContext: (allBindings as AllBindingsAccessor).get('noChildContext') as boolean | undefined,
      };
    }
    const innerContext = bindingContext!.createChildContext(valueAccessor, options);
    applyBindingsToDescendants(innerContext, element);
    return { controlsDescendantBindings: true };
  },
};

bindingHandlers['using'] = usingHandler;
allowedVirtualElementBindings['using'] = true;

// ---- foreach ----

function makeTemplateValueAccessor(valueAccessor: () => unknown): () => Record<string, unknown> {
  return () => {
    const modelValue = valueAccessor();
    // Peek without setting dependency
    const unwrappedValue = (modelValue && typeof modelValue === 'object' && 'peek' in (modelValue as Record<string, unknown>))
      ? (modelValue as { peek(): unknown }).peek()
      : modelValue;

    if (!unwrappedValue || typeof (unwrappedValue as unknown[]).length === 'number') {
      return { foreach: modelValue, templateEngine: nativeTemplateEngine };
    }

    unwrapObservable(modelValue);
    const obj = unwrappedValue as Record<string, unknown>;
    return {
      foreach: obj.data,
      as: obj.as,
      noChildContext: obj.noChildContext,
      includeDestroyed: obj.includeDestroyed,
      afterAdd: obj.afterAdd,
      beforeRemove: obj.beforeRemove,
      afterRender: obj.afterRender,
      beforeMove: obj.beforeMove,
      afterMove: obj.afterMove,
      templateEngine: nativeTemplateEngine,
    };
  };
}

const foreachHandler: BindingHandler = {
  init(element, valueAccessor, allBindings, viewModel, bindingContext) {
    return bindingHandlers['template'].init!(
      element,
      makeTemplateValueAccessor(valueAccessor),
      allBindings,
      viewModel,
      bindingContext,
    );
  },
  update(element, valueAccessor, allBindings, viewModel, bindingContext) {
    return bindingHandlers['template'].update!(
      element,
      makeTemplateValueAccessor(valueAccessor),
      allBindings,
      viewModel,
      bindingContext,
    );
  },
};

bindingHandlers['foreach'] = foreachHandler;
allowedVirtualElementBindings['foreach'] = true;
