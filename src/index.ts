export * from './core.js';

export { wireParams } from './wireParams.js';
export type { WireParamsResult } from './wireParams.js';

export {
  cloneNodes,
  fixUpContinuousNodeArray,
  replaceDomNodes,
  moveCleanedNodesToContainerElement,
  parseHtmlFragment,
  domNodeIsAttachedToDocument,
  anyDomNodeIsAttachedToDocument,
} from './utilsDom.js';

export { domDataGet, domDataSet, domDataGetOrSet, domDataClear, domDataNextKey } from './domData.js';

export { addDisposeCallback, removeDisposeCallback, cleanNode, removeNode } from './domNodeDisposal.js';

export {
  isStartComment,
  hasBindingValue,
  virtualNodeBindingValue,
  virtualChildNodes,
  virtualFirstChild,
  virtualNextSibling,
  virtualEmptyNode,
  virtualSetChildren,
  virtualPrepend,
  virtualInsertAfter,
  allowedVirtualElementBindings,
} from './virtualElements.js';

export {
  parseObjectLiteral,
  preProcessBindings,
  twoWayBindings,
  writeValueToProperty,
  keyValueArrayContainsKey,
} from './expressionRewriting.js';
export type { KeyValuePair, PreProcessOptions, AllBindingsAccessor } from './expressionRewriting.js';

export {
  BindingContext,
  contextFor,
  dataFor,
  storedBindingContextForNode,
  SUBSCRIBABLE,
  ANCESTOR_BINDING_INFO,
  DATA_DEPENDENCY,
  BINDING_INFO_KEY,
} from './bindingContext.js';
export type { BindingContextOptions, CreateChildContextOptions, ExtendCallback } from './bindingContext.js';

export {
  BindingProvider,
  bindingHandlers,
  getBindingHandler,
  addBindingPreprocessor,
  addNodePreprocessor,
  addBindingHandlerCreator,
  chainPreprocessor,
  instance as bindingProviderInstance,
} from './bindingProvider.js';
export type { BindingHandler, PreprocessFn, NodePreprocessFn } from './bindingProvider.js';

export {
  applyBindings,
  applyBindingsToDescendants,
  applyBindingsToNode,
  applyBindingAccessorsToNode,
} from './applyBindings.js';

export { bindingEvent } from './bindingEvent.js';
export type { BindingInfo } from './bindingEvent.js';

import * as selectExtensions from './selectExtensions.js';
export { selectExtensions };

export { DomElementSource, AnonymousSource } from './templateSources.js';

export {
  TemplateEngine,
  NativeTemplateEngine,
  nativeTemplateEngine,
  setTemplateEngine,
  getTemplateEngine,
} from './templateEngine.js';
export type { TemplateRenderOptions, TemplateSource } from './templateEngine.js';

export { setDomNodeChildrenFromArrayMapping } from './arrayToDomMapping.js';
export type { ArrayMappingOptions } from './arrayToDomMapping.js';

export { renderTemplate, renderTemplateForEach } from './templateRendering.js';

import * as memoization from './memoization.js';
export { memoization };

export {
  ensureTemplateIsRewritten,
  memoizeBindingAttributeSyntax,
  applyMemoizedBindingsToNextSibling,
  bindingRewriteValidators,
} from './templateRewriting.js';

import * as components from './components.js';
export { components };
export type { ComponentDefinition, ComponentConfig, ComponentLoader, ComponentInfo } from './components.js';

export { getComponentNameForNode, addBindingsForCustomElement } from './componentBinding.js';

export { component, getComponentTag } from './componentDecorator.js';
export type { ComponentOptions } from './componentDecorator.js';
export type { ViewModelFactory } from './options.js';

export {
  parseInterpolationMarkup,
  wrapExpression,
  interpolationMarkupPreprocessor,
  enableInterpolationMarkup,
} from './interpolationMarkup.js';

export {
  attributeBinding,
  setAttributeBinding,
  attributeInterpolationMarkupPreprocessor,
  enableAttributeInterpolationMarkup,
} from './attributeInterpolationMarkup.js';

export {
  defaultGetNamespacedHandler,
  enableNamespacedBindings,
  autoNamespacedPreprocessor,
  enableAutoNamespacedSyntax,
  addDefaultNamespacedBindingPreprocessor,
} from './namespacedBindings.js';

export {
  filters,
  filterPreprocessor,
  enableTextFilter,
} from './filters.js';

export { enableAll, resetConfigured } from './configure.js';

import './bindings.js';
import './templateRendering.js';
import './controlFlowBindings.js';
import './componentBinding.js';
import './slotBinding.js';
