import { getObservable } from './decorators.js';

// Binding-context identifiers that start with `$`. These are never treated as observable references.
export const CONTEXT_KEYWORDS = new Set([
  '$data', '$rawData', '$root', '$parent', '$parentContext',
  '$parents', '$component', '$componentTemplateNodes', '$index',
  '$context', '$element',
]);

// Resolves `$prop` to the backing observable of `data.prop` (for @reactive accessors),
// falling back to the plain property value (for fields that already hold an observable).
export function resolveObservableRef(data: unknown, prop: string): unknown {
  if (!data || typeof data !== 'object') return undefined;
  return getObservable(data as object, prop) ?? (data as Record<string, unknown>)[prop];
}
