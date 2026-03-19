import type { BindingContext } from './bindingContext.js';
import type { AllBindingsAccessor } from './expressionRewriting.js';
export type { AllBindingsAccessor } from './expressionRewriting.js';
import { preProcessBindings } from './expressionRewriting.js';
import { hasBindingValue, virtualNodeBindingValue } from './virtualElements.js';

const DATA_BIND_ATTR = 'data-bind';

// ---- Binding Handler Interface ----

export interface BindingHandler {
  init?(
    node: Node,
    valueAccessor: () => unknown,
    allBindings: AllBindingsAccessor,
    viewModel: unknown,
    bindingContext: BindingContext,
  ): void | { controlsDescendantBindings: boolean };

  update?(
    node: Node,
    valueAccessor: () => unknown,
    allBindings: AllBindingsAccessor,
    viewModel: unknown,
    bindingContext: BindingContext,
  ): void;

  preprocess?(
    value: string,
    key: string,
    addBinding: (key: string, val: string) => void,
  ): string | void;

  after?: string[];
}

// ---- Binding Handler Registry ----

export const bindingHandlers: Record<string, BindingHandler> = {};

export function getBindingHandler(key: string): BindingHandler | undefined {
  return bindingHandlers[key];
}

// ---- Compiled Binding Function Cache ----

type BindingEvaluator = (context: BindingContext, element: Node) => Record<string, unknown> | null;

function createBindingsStringEvaluator(
  bindingsString: string,
  options?: { valueAccessors?: boolean },
): BindingEvaluator {
  const rewrittenBindings = preProcessBindings(bindingsString, {
    valueAccessors: options?.valueAccessors,
    getBindingHandler,
  });
  const functionBody = "with($context){with($data||{}){return{" + rewrittenBindings + "}}}";
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function("$context", "$element", functionBody) as BindingEvaluator;
}

function createBindingsStringEvaluatorViaCache(
  bindingsString: string,
  cache: Record<string, BindingEvaluator>,
  options?: { valueAccessors?: boolean },
): BindingEvaluator {
  const cacheKey = bindingsString + (options?.valueAccessors ? 'true' : '');
  return cache[cacheKey] || (cache[cacheKey] = createBindingsStringEvaluator(bindingsString, options));
}

// ---- Binding Provider ----

export class BindingProvider {
  bindingCache: Record<string, BindingEvaluator> = {};

  nodeHasBindings(node: Node): boolean {
    switch (node.nodeType) {
      case 1: // Element
        return (node as Element).getAttribute(DATA_BIND_ATTR) != null;
      case 8: // Comment
        return hasBindingValue(node);
      default:
        return false;
    }
  }

  getBindingsString(node: Node): string | null {
    switch (node.nodeType) {
      case 1: // Element
        return (node as Element).getAttribute(DATA_BIND_ATTR);
      case 8: // Comment
        return virtualNodeBindingValue(node);
      default:
        return null;
    }
  }

  getBindingAccessors(
    node: Node,
    bindingContext: BindingContext,
  ): Record<string, () => unknown> | null {
    const bindingsString = this.getBindingsString(node);
    if (!bindingsString) return null;
    return this.parseBindingsString(bindingsString, bindingContext, node, { valueAccessors: true }) as Record<string, () => unknown> | null;
  }

  getBindings(
    node: Node,
    bindingContext: BindingContext,
  ): Record<string, unknown> | null {
    const bindingsString = this.getBindingsString(node);
    if (!bindingsString) return null;
    return this.parseBindingsString(bindingsString, bindingContext, node);
  }

  parseBindingsString(
    bindingsString: string,
    bindingContext: BindingContext,
    node: Node,
    options?: { valueAccessors?: boolean },
  ): Record<string, unknown> | null {
    try {
      const bindingFunction = createBindingsStringEvaluatorViaCache(
        bindingsString,
        this.bindingCache,
        options,
      );
      return bindingFunction(bindingContext, node);
    } catch (ex) {
      const err = ex as Error;
      err.message = "Unable to parse bindings.\nBindings value: " + bindingsString + "\nMessage: " + err.message;
      throw err;
    }
  }
}

export const instance = new BindingProvider();
