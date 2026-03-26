import { options } from './options.js';
import { bindingHandlers, instance as providerInstance } from './bindingProvider.js';
import { enableInterpolationMarkup } from './interpolationMarkup.js';
import { enableAttributeInterpolationMarkup } from './attributeInterpolationMarkup.js';
import { enableNamespacedBindings } from './namespacedBindings.js';
import { enableTextFilter } from './filters.js';

let _enabledInterpolation = false;
let _enabledAttributeInterpolation = false;
let _enabledNamespacedBindings = false;
let _enabledFilters = false;

function enableFiltersGlobal(): void {
  for (const key of Object.keys(bindingHandlers)) {
    enableTextFilter(key);
  }
}

export function ensureConfigured(): void {
  if (options.interpolation && !_enabledInterpolation) {
    _enabledInterpolation = true;
    enableInterpolationMarkup();
  }
  if (options.attributeInterpolation && !_enabledAttributeInterpolation) {
    _enabledAttributeInterpolation = true;
    enableAttributeInterpolationMarkup();
  }
  if (options.namespacedBindings && !_enabledNamespacedBindings) {
    _enabledNamespacedBindings = true;
    enableNamespacedBindings();
  }
  if (options.filters && !_enabledFilters) {
    _enabledFilters = true;
    enableFiltersGlobal();
  }
}

export function resetConfigured(): void {
  _enabledInterpolation = false;
  _enabledAttributeInterpolation = false;
  _enabledNamespacedBindings = false;
  _enabledFilters = false;
  providerInstance.bindingCache = {};
}

export function enableAll(): void {
  options.interpolation = true;
  options.attributeInterpolation = true;
  options.namespacedBindings = true;
  options.filters = true;
  ensureConfigured();
}
