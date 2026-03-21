import { Window } from 'happy-dom';
import {
  BindingProvider,
  bindingHandlers,
  getBindingHandler,
  addBindingPreprocessor,
  addNodePreprocessor,
  addBindingHandlerCreator,
  chainPreprocessor,
  bindingProviderInstance,
} from '#src/index.js';
import type { BindingHandler, PreprocessFn } from '#src/index.js';

const window = new Window();
const document = window.document;

describe('Preprocessor Infrastructure', () => {

  describe('addBindingPreprocessor', () => {
    const testKey = '__preproc_test_' + Date.now();

    afterEach(() => {
      delete bindingHandlers[testKey];
    });

    it('adds a preprocess function to a handler looked up by key', () => {
      bindingHandlers[testKey] = {};
      const spy = jasmine.createSpy('preprocess').and.callFake((v: string) => v.toUpperCase());

      addBindingPreprocessor(testKey, spy);

      const handler = getBindingHandler(testKey)!;
      expect(handler.preprocess).toBeDefined();
      const result = handler.preprocess!('hello', testKey, () => {});
      expect(spy).toHaveBeenCalledWith('hello', testKey, jasmine.any(Function));
      expect(result).toBe('HELLO');
    });

    it('creates a handler if one does not exist for the key', () => {
      expect(getBindingHandler(testKey)).toBeUndefined();

      addBindingPreprocessor(testKey, (v) => v);

      expect(getBindingHandler(testKey)).toBeDefined();
      expect(getBindingHandler(testKey)!.preprocess).toBeDefined();
    });

    it('accepts a handler object directly', () => {
      const handler: BindingHandler = {};
      addBindingPreprocessor(handler, (v) => v + '!');

      expect(handler.preprocess).toBeDefined();
      expect(handler.preprocess!('hi', 'k', () => {})).toBe('hi!');
    });

    it('chains multiple preprocessors in order', () => {
      bindingHandlers[testKey] = {};
      addBindingPreprocessor(testKey, (v) => v + '-first');
      addBindingPreprocessor(testKey, (v) => v + '-second');

      const handler = getBindingHandler(testKey)!;
      const result = handler.preprocess!('start', testKey, () => {});
      expect(result).toBe('start-first-second');
    });

    it('stops the chain if an earlier preprocessor returns undefined', () => {
      bindingHandlers[testKey] = {};
      const secondSpy = jasmine.createSpy('second');

      addBindingPreprocessor(testKey, () => undefined);
      addBindingPreprocessor(testKey, secondSpy);

      const handler = getBindingHandler(testKey)!;
      const result = handler.preprocess!('val', testKey, () => {});
      expect(result).toBeUndefined();
      expect(secondSpy).not.toHaveBeenCalled();
    });

    it('returns the handler for fluent chaining', () => {
      bindingHandlers[testKey] = {};
      const returned = addBindingPreprocessor(testKey, (v) => v);
      expect(returned).toBe(getBindingHandler(testKey));
    });
  });

  describe('chainPreprocessor', () => {
    it('sets preprocess on a handler that has none', () => {
      const handler: BindingHandler = {};
      const fn: PreprocessFn = (v) => v + '!';
      chainPreprocessor(handler, fn);
      expect(handler.preprocess!('hi', 'k', () => {})).toBe('hi!');
    });

    it('chains onto an existing preprocess', () => {
      const handler: BindingHandler = {
        preprocess: (v) => '[' + v + ']',
      };
      chainPreprocessor(handler, (v) => v.toUpperCase());
      expect(handler.preprocess!('hi', 'k', () => {})).toBe('[HI]');
    });
  });

  describe('addNodePreprocessor', () => {
    let originalPreprocessNode: typeof bindingProviderInstance.preprocessNode;

    beforeEach(() => {
      originalPreprocessNode = bindingProviderInstance.preprocessNode;
    });

    afterEach(() => {
      bindingProviderInstance.preprocessNode = originalPreprocessNode;
    });

    it('sets preprocessNode on the provider when none exists', () => {
      bindingProviderInstance.preprocessNode = undefined;
      const spy = jasmine.createSpy('nodePreprocessor');

      addNodePreprocessor(spy);

      expect(bindingProviderInstance.preprocessNode).toBeDefined();
      const textNode = document.createTextNode('test') as unknown as Node;
      bindingProviderInstance.preprocessNode!(textNode);
      expect(spy).toHaveBeenCalledWith(textNode);
    });

    it('chains multiple node preprocessors', () => {
      bindingProviderInstance.preprocessNode = undefined;
      const calls: string[] = [];

      addNodePreprocessor((node) => {
        calls.push('first');
        return undefined;
      });
      addNodePreprocessor((node) => {
        calls.push('second');
        return undefined;
      });

      const textNode = document.createTextNode('test') as unknown as Node;
      bindingProviderInstance.preprocessNode!(textNode);
      expect(calls).toEqual(['first', 'second']);
    });

    it('stops the chain when a preprocessor returns nodes', () => {
      bindingProviderInstance.preprocessNode = undefined;
      const calls: string[] = [];
      const replacements = [document.createTextNode('a') as unknown as Node];

      addNodePreprocessor(() => {
        calls.push('first');
        return replacements;
      });
      addNodePreprocessor(() => {
        calls.push('second');
        return undefined;
      });

      const textNode = document.createTextNode('test') as unknown as Node;
      const result = bindingProviderInstance.preprocessNode!(textNode);
      expect(calls).toEqual(['first']);
      expect(result).toBe(replacements);
    });

    it('runs the second preprocessor if the first returns nothing', () => {
      bindingProviderInstance.preprocessNode = undefined;
      const replacements = [document.createTextNode('b') as unknown as Node];

      addNodePreprocessor(() => undefined);
      addNodePreprocessor(() => replacements);

      const textNode = document.createTextNode('test') as unknown as Node;
      const result = bindingProviderInstance.preprocessNode!(textNode);
      expect(result).toBe(replacements);
    });
  });

  describe('addBindingHandlerCreator', () => {
    const createdHandlers: string[] = [];

    afterEach(() => {
      for (const key of createdHandlers) {
        delete bindingHandlers[key];
      }
      createdHandlers.length = 0;
    });

    it('creates handlers dynamically based on regex match', () => {
      const initSpy = jasmine.createSpy('init');
      addBindingHandlerCreator(/^test-(.+)$/, (match, bindingKey) => {
        const handler: BindingHandler = { init: initSpy };
        createdHandlers.push(bindingKey);
        return handler;
      });

      const handler = getBindingHandler('test-foo');
      expect(handler).toBeDefined();
      expect(handler!.init).toBe(initSpy);
    });

    it('passes the regex match groups to the callback', () => {
      const callbackSpy = jasmine.createSpy('creator').and.returnValue({});
      addBindingHandlerCreator(/^ns\.(.+)$/, callbackSpy);

      getBindingHandler('ns.myProp');
      expect(callbackSpy).toHaveBeenCalled();
      const match = callbackSpy.calls.first().args[0] as RegExpMatchArray;
      expect(match[0]).toBe('ns.myProp');
      expect(match[1]).toBe('myProp');
    });

    it('prefers existing registered handlers over dynamic creation', () => {
      const existing: BindingHandler = { init() {} };
      const testKey = '__existing_' + Date.now();
      bindingHandlers[testKey] = existing;
      createdHandlers.push(testKey);

      const creatorSpy = jasmine.createSpy('creator').and.returnValue({});
      addBindingHandlerCreator(new RegExp('^' + testKey + '$'), creatorSpy);

      const handler = getBindingHandler(testKey);
      expect(handler).toBe(existing);
      expect(creatorSpy).not.toHaveBeenCalled();
    });

    it('returns undefined when regex does not match', () => {
      addBindingHandlerCreator(/^prefix-(.+)$/, () => ({}));
      expect(getBindingHandler('no-match-here')).toBeUndefined();
    });

    it('chains multiple handler creators', () => {
      addBindingHandlerCreator(/^alpha-(.+)$/, (_match, key) => {
        const h: BindingHandler = { init() {} };
        bindingHandlers[key] = h;
        createdHandlers.push(key);
        return h;
      });
      addBindingHandlerCreator(/^beta-(.+)$/, (_match, key) => {
        const h: BindingHandler = { update() {} };
        bindingHandlers[key] = h;
        createdHandlers.push(key);
        return h;
      });

      const alpha = getBindingHandler('alpha-one');
      const beta = getBindingHandler('beta-two');
      expect(alpha).toBeDefined();
      expect(alpha!.init).toBeDefined();
      expect(beta).toBeDefined();
      expect(beta!.update).toBeDefined();
    });
  });
});
