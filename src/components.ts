import { Subscribable } from './subscribable.js';
import { schedule } from './tasks.js';
import { ignore } from './dependencyDetection.js';
import { parseHtmlFragment, cloneNodes } from './utils.js';

// ---- Types ----

export interface ComponentInfo {
  element: Node;
  templateNodes: Node[];
}

export interface ComponentDefinition {
  template?: Node[];
  createViewModel?: (params: unknown, componentInfo: ComponentInfo) => unknown;
}

export interface ComponentConfig {
  template?: unknown;
  viewModel?: unknown;
  synchronous?: boolean;
  [key: string]: unknown;
}

export interface ComponentLoader {
  getConfig?(
    name: string,
    callback: (config: ComponentConfig | null) => void,
  ): void;

  loadComponent?(
    name: string,
    config: ComponentConfig,
    callback: (definition: ComponentDefinition | null) => void,
  ): void;

  loadTemplate?(
    name: string,
    templateConfig: unknown,
    callback: (nodes: Node[] | null) => void,
  ): void;

  loadViewModel?(
    name: string,
    viewModelConfig: unknown,
    callback: (factory: ((params: unknown, info: ComponentInfo) => unknown) | null) => void,
  ): void;

  suppressLoaderExceptions?: boolean;
}

interface CachedDefinition {
  definition: ComponentDefinition | null;
  isSynchronousComponent: boolean;
}

// ---- Caches ----

const loadingSubscribablesCache: Record<string, Subscribable<ComponentDefinition | null>> = {};
const loadedDefinitionsCache: Record<string, CachedDefinition> = {};

// ---- Default Config Registry ----

const defaultConfigRegistry: Record<string, ComponentConfig> = {};

// ---- Registration API ----

export function register(name: string, config: ComponentConfig): void {
  if (!config) {
    throw new Error('Invalid configuration for ' + name);
  }
  if (isRegistered(name)) {
    throw new Error('Component ' + name + ' is already registered');
  }
  defaultConfigRegistry[name] = config;
}

export function isRegistered(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(defaultConfigRegistry, name);
}

export function unregister(name: string): void {
  delete defaultConfigRegistry[name];
  clearCachedDefinition(name);
}

export function clearCachedDefinition(name: string): void {
  delete loadedDefinitionsCache[name];
}

/** Reset all component caches. For testing only. */
export function _resetForTesting(): void {
  for (const key of Object.keys(defaultConfigRegistry)) delete defaultConfigRegistry[key];
  for (const key of Object.keys(loadedDefinitionsCache)) delete loadedDefinitionsCache[key];
  for (const key of Object.keys(loadingSubscribablesCache)) delete loadingSubscribablesCache[key];
}

// ---- Loader Pipeline ----

export function get(
  name: string,
  callback: (definition: ComponentDefinition | null) => void,
): void {
  const cached = Object.prototype.hasOwnProperty.call(loadedDefinitionsCache, name)
    ? loadedDefinitionsCache[name]
    : undefined;

  if (cached) {
    if (cached.isSynchronousComponent) {
      ignore(() => callback(cached.definition));
    } else {
      schedule(() => callback(cached.definition));
    }
  } else {
    loadComponentAndNotify(name, callback);
  }
}

function loadComponentAndNotify(
  name: string,
  callback: (definition: ComponentDefinition | null) => void,
): void {
  let subscribable = Object.prototype.hasOwnProperty.call(loadingSubscribablesCache, name)
    ? loadingSubscribablesCache[name]
    : undefined;

  let completedAsync: boolean | undefined;

  if (!subscribable) {
    subscribable = loadingSubscribablesCache[name] = new Subscribable<ComponentDefinition | null>();
    subscribable.subscribe(callback);

    beginLoadingComponent(name, (definition, config) => {
      const isSynchronousComponent = !!(config && config.synchronous);
      loadedDefinitionsCache[name] = { definition, isSynchronousComponent };
      delete loadingSubscribablesCache[name];

      if (completedAsync || isSynchronousComponent) {
        subscribable!.notifySubscribers(definition);
      } else {
        schedule(() => subscribable!.notifySubscribers(definition));
      }
    });
    completedAsync = true;
  } else {
    subscribable.subscribe(callback);
  }
}

function beginLoadingComponent(
  name: string,
  callback: (definition: ComponentDefinition | null, config: ComponentConfig | null) => void,
): void {
  getFirstResultFromLoaders('getConfig', [name], (config) => {
    if (config) {
      getFirstResultFromLoaders('loadComponent', [name, config as ComponentConfig], (definition) => {
        callback(definition as ComponentDefinition | null, config as ComponentConfig);
      });
    } else {
      callback(null, null);
    }
  });
}

type LoaderMethod = keyof ComponentLoader & ('getConfig' | 'loadComponent' | 'loadTemplate' | 'loadViewModel');

export function getFirstResultFromLoaders(
  methodName: LoaderMethod,
  argsExceptCallback: unknown[],
  callback: (result: unknown) => void,
  candidateLoaders?: ComponentLoader[],
): void {
  if (!candidateLoaders) {
    candidateLoaders = loaders.slice(0);
  }

  const currentCandidateLoader = candidateLoaders.shift();
  if (currentCandidateLoader) {
    const methodInstance = currentCandidateLoader[methodName] as ((...args: unknown[]) => unknown) | undefined;
    if (methodInstance) {
      let wasAborted = false;
      const synchronousReturnValue = methodInstance.apply(
        currentCandidateLoader,
        [...argsExceptCallback, (result: unknown) => {
          if (wasAborted) {
            callback(null);
          } else if (result !== null && result !== undefined) {
            callback(result);
          } else {
            getFirstResultFromLoaders(methodName, argsExceptCallback, callback, candidateLoaders);
          }
        }],
      );

      if (synchronousReturnValue !== undefined) {
        wasAborted = true;
        if (!currentCandidateLoader.suppressLoaderExceptions) {
          throw new Error('Component loaders must supply values by invoking the callback, not by returning values synchronously.');
        }
      }
    } else {
      getFirstResultFromLoaders(methodName, argsExceptCallback, callback, candidateLoaders);
    }
  } else {
    callback(null);
  }
}

// ---- Default Loader ----

function makeErrorCallback(componentName: string): (message: string) => never {
  return function (message: string): never {
    throw new Error("Component '" + componentName + "': " + message);
  };
}

function resolveConfig(
  componentName: string,
  errorCallback: (msg: string) => never,
  config: ComponentConfig,
  callback: (definition: ComponentDefinition) => void,
): void {
  const result: ComponentDefinition = {};
  let remaining = 2;

  const tryIssueCallback = () => {
    if (--remaining === 0) {
      callback(result);
    }
  };

  const templateConfig = config.template;
  const viewModelConfig = config.viewModel;

  if (templateConfig) {
    getFirstResultFromLoaders('loadTemplate', [componentName, templateConfig], (resolvedTemplate) => {
      result.template = resolvedTemplate as Node[];
      tryIssueCallback();
    });
  } else {
    tryIssueCallback();
  }

  if (viewModelConfig) {
    getFirstResultFromLoaders('loadViewModel', [componentName, viewModelConfig], (resolvedViewModel) => {
      result.createViewModel = resolvedViewModel as (params: unknown, info: ComponentInfo) => unknown;
      tryIssueCallback();
    });
  } else {
    tryIssueCallback();
  }
}

function cloneNodesFromTemplateSourceElement(elemInstance: Element): Node[] {
  const tag = elemInstance.tagName?.toLowerCase();
  switch (tag) {
    case 'script':
      return parseHtmlFragment((elemInstance as HTMLScriptElement).text);
    case 'textarea':
      return parseHtmlFragment((elemInstance as HTMLTextAreaElement).value);
    case 'template': {
      const content = (elemInstance as HTMLTemplateElement).content;
      if (isDocumentFragment(content)) {
        return cloneNodes(Array.from(content.childNodes));
      }
      break;
    }
  }
  return cloneNodes(Array.from(elemInstance.childNodes));
}

function isDocumentFragment(obj: unknown): obj is DocumentFragment {
  return !!obj && (obj as Node).nodeType === 11;
}

function isDomElement(obj: unknown): obj is Element {
  return !!obj && (obj as Node).nodeType === 1;
}

function resolveTemplate(
  errorCallback: (msg: string) => never,
  templateConfig: unknown,
  callback: (nodes: Node[]) => void,
): void {
  if (typeof templateConfig === 'string') {
    callback(parseHtmlFragment(templateConfig));
  } else if (Array.isArray(templateConfig)) {
    callback(templateConfig as Node[]);
  } else if (isDocumentFragment(templateConfig)) {
    callback(Array.from(templateConfig.childNodes));
  } else if (templateConfig && typeof templateConfig === 'object' && 'element' in templateConfig) {
    const element = (templateConfig as { element: unknown }).element;
    if (isDomElement(element)) {
      callback(cloneNodesFromTemplateSourceElement(element));
    } else if (typeof element === 'string') {
      const elemInstance = (typeof document !== 'undefined' ? document : null)?.getElementById(element) ?? null;
      if (elemInstance) {
        callback(cloneNodesFromTemplateSourceElement(elemInstance));
      } else {
        errorCallback('Cannot find element with ID ' + element);
      }
    } else {
      errorCallback('Unknown element type: ' + element);
    }
  } else {
    errorCallback('Unknown template value: ' + templateConfig);
  }
}

function resolveViewModel(
  errorCallback: (msg: string) => never,
  viewModelConfig: unknown,
  callback: (factory: (params: unknown, info: ComponentInfo) => unknown) => void,
): void {
  if (typeof viewModelConfig === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    callback((params: unknown) => new (viewModelConfig as any)(params));
  } else if (
    viewModelConfig &&
    typeof viewModelConfig === 'object' &&
    typeof (viewModelConfig as Record<string, unknown>).createViewModel === 'function'
  ) {
    callback((viewModelConfig as { createViewModel: (params: unknown, info: ComponentInfo) => unknown }).createViewModel);
  } else if (viewModelConfig && typeof viewModelConfig === 'object' && 'instance' in viewModelConfig) {
    const fixedInstance = (viewModelConfig as { instance: unknown }).instance;
    callback(() => fixedInstance);
  } else if (viewModelConfig && typeof viewModelConfig === 'object' && 'viewModel' in viewModelConfig) {
    resolveViewModel(errorCallback, (viewModelConfig as { viewModel: unknown }).viewModel, callback);
  } else {
    errorCallback('Unknown viewModel value: ' + viewModelConfig);
  }
}

export const defaultLoader: ComponentLoader = {
  getConfig(name: string, callback: (config: ComponentConfig | null) => void): void {
    callback(isRegistered(name) ? defaultConfigRegistry[name] : null);
  },

  loadComponent(
    name: string,
    config: ComponentConfig,
    callback: (definition: ComponentDefinition | null) => void,
  ): void {
    const errorCallback = makeErrorCallback(name);
    resolveConfig(name, errorCallback, config, callback);
  },

  loadTemplate(
    name: string,
    templateConfig: unknown,
    callback: (nodes: Node[] | null) => void,
  ): void {
    resolveTemplate(makeErrorCallback(name), templateConfig, callback);
  },

  loadViewModel(
    name: string,
    viewModelConfig: unknown,
    callback: (factory: ((params: unknown, info: ComponentInfo) => unknown) | null) => void,
  ): void {
    resolveViewModel(makeErrorCallback(name), viewModelConfig, callback);
  },
};

// ---- Loader Array ----

export const loaders: ComponentLoader[] = [defaultLoader];
