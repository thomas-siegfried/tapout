import {
  bindingHandlers,
  getBindingHandler,
  addBindingHandlerCreator,
  addBindingPreprocessor,
} from './bindingProvider.js';
import type { BindingHandler, PreprocessFn } from './bindingProvider.js';
import { allowedVirtualElementBindings } from './virtualElements.js';
import { parseObjectLiteral } from './expressionRewriting.js';
import type { BindingContext } from './bindingContext.js';
import type { AllBindingsAccessor } from './expressionRewriting.js';

const NAMESPACE_DIVIDER = '.';
const NAMESPACED_BINDING_REGEX = /^([^.]+)\.(.+)$/;

// Translates `namespace.name: value` into `namespace: {name: value}`.
// This works because attr/css/style/event all accept an object map.
export function defaultGetNamespacedHandler(
  this: BindingHandler,
  name: string,
  namespace: string,
  namespacedName: string,
): BindingHandler {
  const handler: BindingHandler = Object.assign({}, this);

  function makeSubValueAccessor(valueAccessor: () => unknown): () => Record<string, unknown> {
    return () => {
      const result: Record<string, unknown> = {};
      result[name] = valueAccessor();
      return result;
    };
  }

  if (handler.init) {
    handler.init = function (
      element: Node,
      valueAccessor: () => unknown,
      allBindings: AllBindingsAccessor,
      viewModel: unknown,
      bindingContext: BindingContext,
    ) {
      return bindingHandlers[namespace].init!.call(
        this, element, makeSubValueAccessor(valueAccessor), allBindings, viewModel, bindingContext,
      );
    };
  }

  if (handler.update) {
    handler.update = function (
      element: Node,
      valueAccessor: () => unknown,
      allBindings: AllBindingsAccessor,
      viewModel: unknown,
      bindingContext: BindingContext,
    ) {
      bindingHandlers[namespace].update!.call(
        this, element, makeSubValueAccessor(valueAccessor), allBindings, viewModel, bindingContext,
      );
    };
  }

  handler.preprocess = undefined;

  if (allowedVirtualElementBindings[namespace]) {
    allowedVirtualElementBindings[namespacedName] = true;
  }

  return handler;
}

// Register the dynamic handler creator for the `namespace.name` pattern.
// When `getBindingHandler('attr.href')` is called and no explicit handler exists,
// this splits on `.`, finds the `attr` handler, and creates a derived handler
// that wraps the single value into the object map format the namespace handler expects.
export function enableNamespacedBindings(): void {
  addBindingHandlerCreator(NAMESPACED_BINDING_REGEX, (match, bindingKey) => {
    const namespace = match[1];
    const namespaceHandler = bindingHandlers[namespace];
    if (namespaceHandler) {
      const name = match[2];
      const handlerFn = namespaceHandler.getNamespacedHandler || defaultGetNamespacedHandler;
      const handler = handlerFn.call(namespaceHandler, name, namespace, bindingKey);
      bindingHandlers[bindingKey] = handler;
      return handler;
    }
    return undefined;
  });
}

// Preprocessor that auto-expands `binding: {key: val, key2: val2}` into
// individual `binding.key: val` and `binding.key2: val2` bindings.
export const autoNamespacedPreprocessor: PreprocessFn = function (
  value: string,
  binding: string,
  addBinding: (key: string, val: string) => void,
): string | void {
  if (value.charAt(0) !== '{') return value;

  const subBindings = parseObjectLiteral(value);
  for (const kv of subBindings) {
    addBinding(binding + NAMESPACE_DIVIDER + (kv.key || kv.unknown || ''), kv.value || '');
  }
};

// Enable the auto-expand preprocessor for a specific binding, so
// `attr: {href: url, title: tip}` auto-expands to `attr.href: url, attr.title: tip`.
export function enableAutoNamespacedSyntax(bindingKeyOrHandler: string | BindingHandler): void {
  addBindingPreprocessor(bindingKeyOrHandler, autoNamespacedPreprocessor);
}

// Add a preprocessor to all dynamically-generated namespaced handlers under a namespace.
// For example, adding a filter preprocessor to 'attr' would make it apply to
// every `attr.x` binding that gets created.
export function addDefaultNamespacedBindingPreprocessor(
  namespace: string,
  preprocessFn: PreprocessFn,
): void {
  const handler = getBindingHandler(namespace);
  if (handler) {
    const previousHandlerFn = handler.getNamespacedHandler || defaultGetNamespacedHandler;
    handler.getNamespacedHandler = function (
      name: string,
      ns: string,
      namespacedName: string,
    ): BindingHandler {
      const created = previousHandlerFn.call(this, name, ns, namespacedName);
      return addBindingPreprocessor(created, preprocessFn);
    };
  }
}
