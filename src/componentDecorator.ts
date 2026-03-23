import * as components from './components.js';
import type { ComponentInfo } from './components.js';
import { options } from './options.js';

// --- Tag storage ---

const componentTagMap = new WeakMap<object, string>();

/**
 * Retrieve the custom element tag registered by @component.
 * Accepts either the decorated class or an instance of it.
 */
export function getComponentTag(target: object): string | undefined {
  if (typeof target === 'function') {
    return componentTagMap.get(target);
  }
  return componentTagMap.get(target.constructor);
}

// --- @component decorator ---

export interface ComponentOptions {
  tag: string;
  template: string;
  synchronous?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClass = new (...args: any[]) => any;
type ComponentClassDecorator = (target: AnyClass, context: ClassDecoratorContext) => void;

export function component(tag: string, template: string): ComponentClassDecorator;
export function component(options: ComponentOptions): ComponentClassDecorator;
export function component(
  tagOrOptions: string | ComponentOptions,
  template?: string,
): ComponentClassDecorator {
  const opts: ComponentOptions = typeof tagOrOptions === 'string'
    ? { tag: tagOrOptions, template: template! }
    : tagOrOptions;

  return function (target: AnyClass, _context: ClassDecoratorContext): void {
    componentTagMap.set(target, opts.tag);

    components.register(opts.tag, {
      template: opts.template,
      viewModel: {
        createViewModel(_params: unknown, _componentInfo: ComponentInfo) {
          return options.viewModelFactory(target);
        },
      },
      synchronous: opts.synchronous,
    });
  };
}
