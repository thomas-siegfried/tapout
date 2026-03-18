import { Observable } from './observable.js';
import { Computed, PureComputed } from './computed.js';
import { domDataGet } from './domData.js';
import { getDependencies } from './dependencyDetection.js';

/** Unwrap using get() so the read registers as a dependency in the current tracking frame. */
function unwrapObservable(value: unknown): unknown {
  if (value instanceof Observable) return value.get();
  if (value instanceof Computed) return value.get();
  return value;
}

function isObservableOrComputed(value: unknown): value is Observable<unknown> | Computed<unknown> {
  return value instanceof Observable || value instanceof Computed;
}

const SUBSCRIBABLE = Symbol('subscribable');
const ANCESTOR_BINDING_INFO = Symbol('ancestorBindingInfo');
const DATA_DEPENDENCY = Symbol('dataDependency');
const INHERIT = Symbol('inheritParentVm');

export { SUBSCRIBABLE, ANCESTOR_BINDING_INFO, DATA_DEPENDENCY };

export interface BindingContextOptions {
  exportDependencies?: boolean;
  dataDependency?: Computed<unknown>;
}

export interface CreateChildContextOptions {
  as?: string;
  extend?: (context: BindingContext) => void;
  noChildContext?: boolean;
  exportDependencies?: boolean;
  dataDependency?: Computed<unknown>;
}

export type ExtendCallback = (
  self: BindingContext,
  parentContext: BindingContext | undefined,
  dataItem: unknown,
) => void;

export class BindingContext {
  $data: unknown;
  $rawData: unknown;
  $root: unknown;
  $parent?: unknown;
  $parentContext?: BindingContext;
  $parents: unknown[] = [];

  [SUBSCRIBABLE]?: PureComputed<unknown>;
  [ANCESTOR_BINDING_INFO]?: unknown;
  [DATA_DEPENDENCY]?: Computed<unknown>;

  // Allow dynamic alias properties set by createChildContext/extend
  [key: string | symbol]: unknown;

  constructor(
    dataItemOrAccessor: unknown,
    parentContext?: BindingContext,
    dataItemAlias?: string | null,
    extendCallback?: ExtendCallback,
    options?: BindingContextOptions,
  ) {
    const self = this;
    const shouldInheritData = dataItemOrAccessor === INHERIT;
    const realDataItemOrAccessor = shouldInheritData ? undefined : dataItemOrAccessor;
    const isFunc = typeof realDataItemOrAccessor === 'function' && !isObservableOrComputed(realDataItemOrAccessor);
    const dataDependency = options?.dataDependency;

    function updateContext() {
      const dataItemOrObservable = isFunc
        ? (realDataItemOrAccessor as () => unknown)()
        : realDataItemOrAccessor;
      const dataItem = unwrapObservable(dataItemOrObservable);

      if (parentContext) {
        Object.assign(self, parentContext);

        if (ANCESTOR_BINDING_INFO in parentContext) {
          self[ANCESTOR_BINDING_INFO] = parentContext[ANCESTOR_BINDING_INFO];
        }
      } else {
        self.$parents = [];
        self.$root = dataItem;
      }

      self[SUBSCRIBABLE] = subscribable;

      if (shouldInheritData) {
        // $data is already set from parent via Object.assign
      } else {
        self.$rawData = dataItemOrObservable;
        self.$data = dataItem;
      }

      if (dataItemAlias) {
        self[dataItemAlias] = dataItem;
      }

      if (extendCallback) {
        extendCallback(self, parentContext, dataItem);
      }

      // Ensure child depends on parent context's data dependencies.
      // Reading the parent subscribable registers it as a dependency of
      // the current PureComputed. Dependency deduplication makes this safe
      // even if updateContext already transitively depends on it.
      if (parentContext?.[SUBSCRIBABLE]) {
        parentContext[SUBSCRIBABLE]!.get();
      }

      if (dataDependency) {
        self[DATA_DEPENDENCY] = dataDependency;
      }

      return self.$data;
    }

    let subscribable: PureComputed<unknown> | undefined;

    if (options?.exportDependencies) {
      updateContext();
    } else {
      subscribable = new PureComputed(updateContext);
      subscribable.peek();

      if (subscribable.isActive()) {
        subscribable.equalityComparer = undefined;
      } else {
        self[SUBSCRIBABLE] = undefined;
      }
    }
  }

  createChildContext(
    dataItemOrAccessor: unknown,
    aliasOrOptions?: string | CreateChildContextOptions,
    extendCallback?: (context: BindingContext) => void,
    options?: BindingContextOptions,
  ): BindingContext {
    let dataItemAlias: string | undefined;

    if (!options && aliasOrOptions && typeof aliasOrOptions === 'object') {
      options = aliasOrOptions;
      dataItemAlias = aliasOrOptions.as;
      extendCallback = aliasOrOptions.extend;
    } else if (typeof aliasOrOptions === 'string') {
      dataItemAlias = aliasOrOptions;
    }

    const childOptions = options as CreateChildContextOptions | undefined;

    if (dataItemAlias && childOptions?.noChildContext) {
      const isFunc = typeof dataItemOrAccessor === 'function' && !isObservableOrComputed(dataItemOrAccessor);
      return new BindingContext(INHERIT, this, null, (self) => {
        if (extendCallback) {
          extendCallback(self);
        }
        self[dataItemAlias!] = isFunc ? (dataItemOrAccessor as () => unknown)() : dataItemOrAccessor;
      }, options);
    }

    return new BindingContext(dataItemOrAccessor, this, dataItemAlias, (self, parentCtx) => {
      self.$parentContext = parentCtx;
      self.$parent = parentCtx?.$data;
      self.$parents = (parentCtx?.$parents || []).slice(0);
      self.$parents.unshift(self.$parent);
      if (extendCallback) {
        extendCallback(self);
      }
    }, options);
  }

  extend(
    properties: Record<string, unknown> | ((self: BindingContext) => Record<string, unknown>) | null,
    options?: BindingContextOptions,
  ): BindingContext {
    return new BindingContext(INHERIT, this, null, (self) => {
      if (properties) {
        Object.assign(
          self,
          typeof properties === 'function' ? properties(self) : properties,
        );
      }
    }, options);
  }
}

// DOM data key for storing binding info on nodes (shared with applyBindings)
export const BINDING_INFO_KEY = '__tapout_bindingInfo';

interface BindingInfo {
  context?: BindingContext;
  alreadyBound?: boolean;
}

export function storedBindingContextForNode(node: Node): BindingContext | undefined {
  const info = domDataGet(node, BINDING_INFO_KEY) as BindingInfo | undefined;
  return info?.context;
}

export function contextFor(node: Node): BindingContext | undefined {
  if (node && (node.nodeType === 1 || node.nodeType === 8)) {
    return storedBindingContextForNode(node);
  }
  return undefined;
}

export function dataFor(node: Node): unknown {
  const context = contextFor(node);
  return context ? context.$data : undefined;
}
