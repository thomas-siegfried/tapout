import { Observable } from './observable.js';
import { Computed } from './computed.js';
import { isSubscribable } from './subscribable.js';

// ---- Types ----

export interface KeyValuePair {
  key?: string;
  value?: string;
  unknown?: string;
}

export interface PreProcessOptions {
  valueAccessors?: boolean;
  bindingParams?: boolean;
  getBindingHandler?: (key: string) => { preprocess?(val: string, key: string, addBinding: (key: string, val: string) => void): string | void } | undefined;
}

export interface AllBindingsAccessor {
  get(key: string): unknown;
  has(key: string): boolean;
}

// ---- Two-way binding registry ----

export const twoWayBindings: Record<string, boolean | string> = {};

// ---- Token regex ----

const javaScriptReservedWords = ['true', 'false', 'null', 'undefined'];

// Matches something assignable: an isolated identifier or something ending with a property accessor.
const javaScriptAssignmentTarget = /^(?:[$_a-z][$\w]*|(.+)(\.\s*[$_a-z][$\w]*|\[.+\]))$/i;

const specials = ',"\'`{}()/:[\\]';
const bindingToken = RegExp([
  '"(?:\\\\.|[^"])*"',              // double-quoted string
  "'(?:\\\\.|[^'])*'",              // single-quoted string
  '`(?:\\\\.|[^`])*`',             // template literal
  '/\\*(?:[^*]|\\*+[^*/])*\\*+/',  // block comment
  '//.*\n',                         // line comment
  '/(?:\\\\.|[^/])+/\\w*',          // regex literal
  '[^\\s:,/][^' + specials + ']*[^\\s' + specials + ']', // multi-char token
  '[^\\s]',                         // single char
].join('|'), 'g');

const divisionLookBehind = /[\])"'A-Za-z0-9_$]+$/;
const keywordRegexLookBehind: Record<string, number> = { 'in': 1, 'return': 1, 'typeof': 1 };

// ---- Core functions ----

function getWriteableValue(expression: string): string | false {
  if (javaScriptReservedWords.indexOf(expression) >= 0) return false;
  const match = expression.match(javaScriptAssignmentTarget);
  if (match === null) return false;
  return match[1] ? ('Object(' + match[1] + ')' + match[2]) : expression;
}

export function parseObjectLiteral(objectLiteralString: string): KeyValuePair[] {
  let str = objectLiteralString.trim();

  // Strip surrounding braces
  if (str.charCodeAt(0) === 123 /* { */) str = str.slice(1, -1);

  // Append newline + comma so the last pair terminates uniformly
  str += '\n,';

  const toks = str.match(bindingToken);
  const result: KeyValuePair[] = [];

  if (!toks || toks.length <= 1) return result;

  let key: string | undefined;
  let values: string[] = [];
  let depth = 0;

  for (let i = 0, tok: string; (tok = toks[i]); ++i) {
    const c = tok.charCodeAt(0);

    if (c === 44 /* , */) {
      if (depth <= 0) {
        result.push(
          (key && values.length)
            ? { key, value: values.join('') }
            : { unknown: key || values.join('') },
        );
        key = undefined;
        depth = 0;
        values = [];
        continue;
      }
    } else if (c === 58 /* : */) {
      if (!depth && !key && values.length === 1) {
        key = values.pop()!;
        continue;
      }
    } else if (c === 47 /* / */ && tok.length > 1 && (tok.charCodeAt(1) === 47 || tok.charCodeAt(1) === 42)) {
      // Line or block comment — skip
      continue;
    } else if (c === 47 /* / */ && i && tok.length > 1) {
      // Disambiguate regex vs division
      const prevMatch = toks[i - 1].match(divisionLookBehind);
      if (prevMatch && !keywordRegexLookBehind[prevMatch[0]]) {
        str = str.substr(str.indexOf(tok) + 1);
        const newToks = str.match(bindingToken);
        if (newToks) {
          toks.length = 0;
          toks.push(...newToks);
        }
        i = -1;
        tok = '/';
      }
    } else if (c === 40 || c === 123 || c === 91) {
      // ( { [
      ++depth;
    } else if (c === 41 || c === 125 || c === 93) {
      // ) } ]
      --depth;
    } else if (!key && !values.length && (c === 34 || c === 39)) {
      // Quoted key — strip quotes
      tok = tok.slice(1, -1);
    }

    values.push(tok);
  }

  if (depth > 0) {
    throw new Error('Unbalanced parentheses, braces, or brackets');
  }

  return result;
}

export function preProcessBindings(
  bindingsStringOrKeyValueArray: string | KeyValuePair[],
  options?: PreProcessOptions,
): string {
  options = options || {};

  const resultStrings: string[] = [];
  const propertyAccessorResultStrings: string[] = [];
  const makeValueAccessors = options.valueAccessors;
  const bindingParams = options.bindingParams;
  const getBindingHandler = options.getBindingHandler;

  const keyValueArray = typeof bindingsStringOrKeyValueArray === 'string'
    ? parseObjectLiteral(bindingsStringOrKeyValueArray)
    : bindingsStringOrKeyValueArray;

  function processKeyValue(key: string, val: string) {
    let writableVal: string | false;

    function callPreprocessHook(
      obj: { preprocess?(val: string, key: string, addBinding: (key: string, val: string) => void): string | void } | undefined,
    ): boolean {
      if (obj && obj.preprocess) {
        const result = obj.preprocess(val, key, processKeyValue);
        if (result !== undefined) val = result;
        return result !== undefined;
      }
      return true;
    }

    if (!bindingParams) {
      if (getBindingHandler && !callPreprocessHook(getBindingHandler(key))) return;

      if (twoWayBindings[key] && (writableVal = getWriteableValue(val))) {
        const writeKey = typeof twoWayBindings[key] === 'string' ? twoWayBindings[key] as string : key;
        propertyAccessorResultStrings.push("'" + writeKey + "':function(_z){" + writableVal + '=_z}');
      }
    }

    if (makeValueAccessors) {
      val = 'function(){return ' + val + ' }';
    }

    resultStrings.push("'" + key + "':" + val);
  }

  for (const kv of keyValueArray) {
    processKeyValue(kv.key || kv.unknown || '', kv.value || '');
  }

  if (propertyAccessorResultStrings.length) {
    processKeyValue('_tap_property_writers', '{' + propertyAccessorResultStrings.join(',') + ' }');
  }

  return resultStrings.join(',');
}

export function keyValueArrayContainsKey(keyValueArray: KeyValuePair[], key: string): boolean {
  for (const kv of keyValueArray) {
    if (kv.key === key) return true;
  }
  return false;
}

export function writeValueToProperty(
  property: unknown,
  allBindings: AllBindingsAccessor,
  key: string,
  value: unknown,
  checkIfDifferent?: boolean,
): void {
  if (!property || !isSubscribable(property)) {
    const propWriters = allBindings.get('_tap_property_writers') as Record<string, (v: unknown) => void> | undefined;
    if (propWriters && propWriters[key]) {
      propWriters[key](value);
    }
  } else if (isWritable(property) && (!checkIfDifferent || property.peek() !== value)) {
    property.set(value as never);
  }
}

function isWritable(value: unknown): value is Observable<unknown> | Computed<unknown> {
  if (value instanceof Observable) return true;
  if (value instanceof Computed) return value.hasWriteFunction;
  return false;
}
