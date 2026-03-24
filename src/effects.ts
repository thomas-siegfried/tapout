import { PureComputed } from './computed.js';

export interface EffectHandle {
  dispose(): void;
}

/**
 * Track reactive dependencies in `fn` and call `act` whenever they change.
 * Returns a handle to stop the effect.
 */
export function observe<T>(fn: () => T, act: (val: T) => void): EffectHandle {
  const computed = new PureComputed(fn);
  computed.extend({ notify: 'always' });
  const subscription = computed.subscribe(act);
  return {
    dispose() {
      subscription.dispose();
      computed.dispose();
    },
  };
}

/**
 * Same as `observe`, but also runs `act` immediately with the current value.
 */
export function effect<T>(fn: () => T, act: (val: T) => void): EffectHandle {
  act(fn());
  return observe(fn, act);
}
