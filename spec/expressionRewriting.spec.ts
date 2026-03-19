import {
  parseObjectLiteral,
  preProcessBindings,
  twoWayBindings,
  writeValueToProperty,
  keyValueArrayContainsKey,
} from '#src/expressionRewriting.js';
import type { KeyValuePair, AllBindingsAccessor } from '#src/expressionRewriting.js';
import { Observable } from '#src/observable.js';
import { Computed } from '#src/computed.js';

describe('expressionRewriting', () => {

  describe('parseObjectLiteral', () => {
    it('parses simple key-value pairs', () => {
      const result = parseObjectLiteral('text: name, visible: isShown');
      expect(result).toEqual([
        { key: 'text', value: 'name' },
        { key: 'visible', value: 'isShown' },
      ]);
    });

    it('parses a single key-value pair', () => {
      const result = parseObjectLiteral('text: name');
      expect(result).toEqual([{ key: 'text', value: 'name' }]);
    });

    it('handles empty input', () => {
      expect(parseObjectLiteral('')).toEqual([]);
    });

    it('handles whitespace-only input', () => {
      expect(parseObjectLiteral('   ')).toEqual([]);
    });

    it('strips surrounding braces', () => {
      const result = parseObjectLiteral('{ text: name, visible: isShown }');
      expect(result).toEqual([
        { key: 'text', value: 'name' },
        { key: 'visible', value: 'isShown' },
      ]);
    });

    it('handles nested objects as values', () => {
      const result = parseObjectLiteral('foreach: { data: items, as: "item" }');
      expect(result.length).toBe(1);
      expect(result[0].key).toBe('foreach');
      expect(result[0].value).toContain('data');
      expect(result[0].value).toContain('items');
    });

    it('handles nested arrays as values', () => {
      const result = parseObjectLiteral('data: [1, 2, 3]');
      expect(result.length).toBe(1);
      expect(result[0].key).toBe('data');
      expect(result[0].value).toContain('[1');
      expect(result[0].value).toContain('3]');
    });

    it('handles function calls in values', () => {
      const result = parseObjectLiteral('click: handleClick(item, $data)');
      expect(result.length).toBe(1);
      expect(result[0].key).toBe('click');
      expect(result[0].value).toContain('handleClick(item');
      expect(result[0].value).toContain('$data)');
    });

    it('handles double-quoted string keys', () => {
      const result = parseObjectLiteral('"my-key": value');
      expect(result[0].key).toBe('my-key');
    });

    it('handles single-quoted string keys', () => {
      const result = parseObjectLiteral("'my-key': value");
      expect(result[0].key).toBe('my-key');
    });

    it('handles double-quoted string values', () => {
      const result = parseObjectLiteral('text: "hello world"');
      expect(result[0].key).toBe('text');
      expect(result[0].value).toBe('"hello world"');
    });

    it('handles values with escaped quotes in strings', () => {
      const result = parseObjectLiteral('text: "say \\"hi\\""');
      expect(result[0].value).toContain('\\"hi\\"');
    });

    it('returns unknown for bare expressions without a key', () => {
      const result = parseObjectLiteral('someExpression');
      expect(result).toEqual([{ unknown: 'someExpression' }]);
    });

    it('handles line comments', () => {
      const result = parseObjectLiteral('text: name, // a comment\nvisible: isShown');
      expect(result).toEqual([
        { key: 'text', value: 'name' },
        { key: 'visible', value: 'isShown' },
      ]);
    });

    it('handles block comments', () => {
      const result = parseObjectLiteral('text: name, /* comment */ visible: isShown');
      expect(result).toEqual([
        { key: 'text', value: 'name' },
        { key: 'visible', value: 'isShown' },
      ]);
    });

    it('handles ternary expressions', () => {
      const result = parseObjectLiteral('text: isReady ? "yes" : "no"');
      expect(result.length).toBe(1);
      expect(result[0].key).toBe('text');
      expect(result[0].value).toContain('isReady');
      expect(result[0].value).toContain('"yes"');
      expect(result[0].value).toContain('"no"');
    });

    it('handles property access with dot notation', () => {
      const result = parseObjectLiteral('text: model.name');
      expect(result[0].value).toBe('model.name');
    });

    it('handles property access with bracket notation', () => {
      const result = parseObjectLiteral('text: model["name"]');
      expect(result[0].value).toBe('model["name"]');
    });

    it('throws on unbalanced brackets', () => {
      expect(() => parseObjectLiteral('text: fn(a, b')).toThrowError(/Unbalanced/);
    });

    it('handles multiple nested levels', () => {
      const result = parseObjectLiteral('attr: { title: name, "data-id": id() }');
      expect(result.length).toBe(1);
      expect(result[0].key).toBe('attr');
    });
  });

  describe('preProcessBindings', () => {
    it('produces key-value output from a string', () => {
      const result = preProcessBindings('text: name');
      expect(result).toBe("'text':name");
    });

    it('handles multiple bindings', () => {
      const result = preProcessBindings('text: name, visible: isShown');
      expect(result).toBe("'text':name,'visible':isShown");
    });

    it('wraps values in accessor functions when valueAccessors is true', () => {
      const result = preProcessBindings('text: name', { valueAccessors: true });
      expect(result).toBe("'text':function(){return name }");
    });

    it('generates two-way writers for registered two-way bindings', () => {
      twoWayBindings['testValue'] = true;
      try {
        const result = preProcessBindings('testValue: myProp');
        expect(result).toContain("'testValue':myProp");
        expect(result).toContain("'_ko_property_writers'");
        expect(result).toContain("'testValue':function(_z){myProp=_z}");
      } finally {
        delete twoWayBindings['testValue'];
      }
    });

    it('uses aliased key for two-way writers when value is a string', () => {
      twoWayBindings['testAlias'] = 'testCanonical';
      try {
        const result = preProcessBindings('testAlias: isFocused');
        expect(result).toContain("'testCanonical':function(_z){isFocused=_z}");
      } finally {
        delete twoWayBindings['testAlias'];
      }
    });

    it('does not generate writers for non-writable expressions', () => {
      twoWayBindings['testValue'] = true;
      try {
        const result = preProcessBindings('testValue: true');
        expect(result).not.toContain('_ko_property_writers');
      } finally {
        delete twoWayBindings['testValue'];
      }
    });

    it('does not generate writers when binding is not registered as two-way', () => {
      const result = preProcessBindings('text: name');
      expect(result).not.toContain('_ko_property_writers');
    });

    it('wraps Object() around complex assignment targets', () => {
      twoWayBindings['testValue'] = true;
      try {
        const result = preProcessBindings('testValue: obj.prop');
        expect(result).toContain('Object(obj).prop=_z');
      } finally {
        delete twoWayBindings['testValue'];
      }
    });

    it('accepts a pre-parsed key-value array', () => {
      const parsed: KeyValuePair[] = [
        { key: 'text', value: 'name' },
        { key: 'visible', value: 'isShown' },
      ];
      const result = preProcessBindings(parsed);
      expect(result).toBe("'text':name,'visible':isShown");
    });

    it('skips two-way writers in bindingParams mode', () => {
      twoWayBindings['testValue'] = true;
      try {
        const result = preProcessBindings('testValue: myProp', { bindingParams: true });
        expect(result).not.toContain('_ko_property_writers');
      } finally {
        delete twoWayBindings['testValue'];
      }
    });

    it('calls preprocess hook via getBindingHandler', () => {
      const result = preProcessBindings('myBinding: val', {
        getBindingHandler: (key) => {
          if (key === 'myBinding') {
            return {
              preprocess: (val: string) => val + '.toUpperCase()',
            };
          }
          return undefined;
        },
      });
      expect(result).toBe("'myBinding':val.toUpperCase()");
    });
  });

  describe('keyValueArrayContainsKey', () => {
    const arr: KeyValuePair[] = [
      { key: 'text', value: 'name' },
      { key: 'visible', value: 'isShown' },
    ];

    it('returns true when key exists', () => {
      expect(keyValueArrayContainsKey(arr, 'text')).toBe(true);
      expect(keyValueArrayContainsKey(arr, 'visible')).toBe(true);
    });

    it('returns false when key does not exist', () => {
      expect(keyValueArrayContainsKey(arr, 'click')).toBe(false);
    });

    it('returns false for empty array', () => {
      expect(keyValueArrayContainsKey([], 'text')).toBe(false);
    });
  });

  describe('writeValueToProperty', () => {
    it('writes directly to a writable observable', () => {
      const obs = new Observable('old');
      const allBindings: AllBindingsAccessor = { get: () => undefined, has: () => false };
      writeValueToProperty(obs, allBindings, 'value', 'new');
      expect(obs.peek()).toBe('new');
    });

    it('skips write when checkIfDifferent is true and value is the same', () => {
      const obs = new Observable('same');
      const allBindings: AllBindingsAccessor = { get: () => undefined, has: () => false };
      spyOn(obs, 'set');
      writeValueToProperty(obs, allBindings, 'value', 'same', true);
      expect(obs.set).not.toHaveBeenCalled();
    });

    it('writes when checkIfDifferent is true but value is different', () => {
      const obs = new Observable('old');
      const allBindings: AllBindingsAccessor = { get: () => undefined, has: () => false };
      writeValueToProperty(obs, allBindings, 'value', 'new', true);
      expect(obs.peek()).toBe('new');
    });

    it('writes to a writable computed', () => {
      const obs = new Observable('old');
      const comp = new Computed({
        read: () => obs.get(),
        write: (val: string) => obs.set(val),
      });
      const allBindings: AllBindingsAccessor = { get: () => undefined, has: () => false };
      writeValueToProperty(comp, allBindings, 'value', 'new');
      expect(obs.peek()).toBe('new');
    });

    it('falls back to _ko_property_writers for non-observable', () => {
      let written: unknown;
      const writers = { value: (v: unknown) => { written = v; } };
      const allBindings: AllBindingsAccessor = {
        get: (key: string) => key === '_ko_property_writers' ? writers : undefined,
        has: () => false,
      };
      writeValueToProperty('not-an-observable', allBindings, 'value', 'hello');
      expect(written).toBe('hello');
    });

    it('falls back to _ko_property_writers for null property', () => {
      let written: unknown;
      const writers = { value: (v: unknown) => { written = v; } };
      const allBindings: AllBindingsAccessor = {
        get: (key: string) => key === '_ko_property_writers' ? writers : undefined,
        has: () => false,
      };
      writeValueToProperty(null, allBindings, 'value', 42);
      expect(written).toBe(42);
    });

    it('does nothing when no observable and no property writers', () => {
      const allBindings: AllBindingsAccessor = { get: () => undefined, has: () => false };
      expect(() => writeValueToProperty('plain', allBindings, 'value', 'test')).not.toThrow();
    });
  });

  describe('twoWayBindings', () => {
    it('is an object', () => {
      expect(typeof twoWayBindings).toBe('object');
    });

    it('can register and read bindings', () => {
      twoWayBindings['myCustomBinding'] = true;
      expect(twoWayBindings['myCustomBinding']).toBe(true);
      delete twoWayBindings['myCustomBinding'];
    });

    it('supports string aliases', () => {
      twoWayBindings['testAlias'] = 'testCanonical';
      expect(twoWayBindings['testAlias']).toBe('testCanonical');
      delete twoWayBindings['testAlias'];
    });
  });
});
