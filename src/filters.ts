import { addBindingPreprocessor, setFiltersRegistry } from './bindingProvider.js';
import type { PreprocessFn } from './bindingProvider.js';
import { unwrapObservable, toJSON } from './utils.js';

// ---- Filter Registry ----

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export const filters: Record<string, Function> = {};

// Register the filters object so binding expressions can access it as $filters
setFiltersRegistry(filters);

// ---- Filter Preprocessor ----

// Tokenizer regex: matches quoted strings, || (logical OR — not a pipe), single | and :
// as individual tokens, and any non-whitespace runs between delimiters.
const TOKEN_REGEX = /"([^"\\]|\\.)*"|'([^'\\]|\\.)*'|\|\||[|:]|[^\s|:"'][^|:"']*[^\s|:"']|[^\s|:"']/g;

// Transforms `expression | filter1 | filter2:arg1:arg2` into
// `$filters['filter2']($filters['filter1'](expression),arg1,arg2)`
export const filterPreprocessor: PreprocessFn = function (input: string): string | void {
  if (input.indexOf('|') === -1) return input;

  const tokens = input.match(TOKEN_REGEX);
  if (tokens && tokens.length > 1) {
    tokens.push('|');
    let result = tokens[0];
    let lastToken: string | undefined;
    let inFilters = false;
    let nextIsFilter = false;

    for (let i = 1; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === '|') {
        if (inFilters) {
          if (lastToken === ':') result += 'undefined';
          result += ')';
        }
        nextIsFilter = true;
        inFilters = true;
      } else {
        if (nextIsFilter) {
          result = "$filters['" + token + "'](" + result;
        } else if (inFilters && token === ':') {
          if (lastToken === ':') result += 'undefined';
          result += ',';
        } else {
          result += token;
        }
        nextIsFilter = false;
      }
      lastToken = token;
    }

    return result;
  }

  return input;
};

// Enable the filter preprocessor for a specific binding handler
export function enableTextFilter(bindingKeyOrHandler: string): void {
  addBindingPreprocessor(bindingKeyOrHandler, filterPreprocessor);
}

// ---- Built-in Filters ----

filters['uppercase'] = function (value: unknown): string {
  return String(unwrapObservable(value) ?? '').toUpperCase();
};

filters['lowercase'] = function (value: unknown): string {
  return String(unwrapObservable(value) ?? '').toLowerCase();
};

filters['default'] = function (value: unknown, defaultValue: unknown): unknown {
  const unwrapped = unwrapObservable(value);
  if (typeof unwrapped === 'function') return unwrapped;
  if (typeof unwrapped === 'string') return unwrapped.trim() === '' ? defaultValue : unwrapped;
  if (unwrapped == null) return defaultValue;
  if (Array.isArray(unwrapped) && unwrapped.length === 0) return defaultValue;
  return unwrapped;
};

filters['json'] = function (
  rootObject: unknown,
  space?: string | number,
  replacer?: (key: string, value: unknown) => unknown,
): string {
  return toJSON(rootObject, replacer, space);
};
