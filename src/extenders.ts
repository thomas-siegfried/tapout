import type { Subscribable } from './subscribable.js';
import { valuesArePrimitiveAndEqual } from './subscribable.js';

export type ExtenderHandler = (target: Subscribable, value: unknown) => Subscribable | void;

const registry: Record<string, ExtenderHandler> = {};

export function registerExtender(name: string, handler: ExtenderHandler): void {
  registry[name] = handler;
}

export function getExtenderHandler(name: string): ExtenderHandler | undefined {
  return registry[name];
}

export function throttle(callback: () => void, timeout: number): () => void {
  let timeoutInstance: ReturnType<typeof setTimeout> | undefined;
  return function () {
    if (!timeoutInstance) {
      timeoutInstance = setTimeout(function () {
        timeoutInstance = undefined;
        callback();
      }, timeout);
    }
  };
}

export function debounce(callback: () => void, timeout: number): () => void {
  let timeoutInstance: ReturnType<typeof setTimeout> | undefined;
  return function () {
    clearTimeout(timeoutInstance);
    timeoutInstance = setTimeout(callback, timeout);
  };
}

export interface RateLimitOptions {
  timeout: number;
  method?: 'notifyWhenChangesStop' | ((callback: () => void, timeout: number) => () => void);
}

registerExtender('notify', (target, notifyWhen) => {
  target.equalityComparer = notifyWhen === 'always'
    ? undefined
    : valuesArePrimitiveAndEqual;
});

registerExtender('rateLimit', (target, options) => {
  let timeout: number;
  let method: RateLimitOptions['method'] | undefined;

  if (typeof options === 'number') {
    timeout = options;
  } else {
    const opts = options as RateLimitOptions;
    timeout = opts.timeout;
    method = opts.method;
  }

  const limitFunction = typeof method === 'function'
    ? method
    : method === 'notifyWhenChangesStop' ? debounce : throttle;

  target.limit((callback) => limitFunction(callback, timeout));
});
