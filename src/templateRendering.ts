import { Computed } from './computed.js';
import { ignore } from './dependencyDetection.js';
import { BindingContext } from './bindingContext.js';
import { domDataGet, domDataSet, domDataNextKey } from './domData.js';
import { addDisposeCallback } from './domNodeDisposal.js';
import { bindingEvent } from './bindingEvent.js';
import { applyBindings, applyBindingsToDescendants } from './applyBindings.js';
import { instance as providerInstance } from './bindingProvider.js';
import type { BindingHandler } from './bindingProvider.js';
import { bindingHandlers } from './bindingProvider.js';
import { allowedVirtualElementBindings, virtualChildNodes, virtualEmptyNode, virtualSetChildren, virtualNextSibling } from './virtualElements.js';
import { isReadableSubscribable } from './subscribable.js';
import { isObservableArray, type ObservableArray } from './observableArray.js';
import { AnonymousSource } from './templateSources.js';
import { getTemplateEngine } from './templateEngine.js';
import type { TemplateEngine, TemplateRenderOptions } from './templateEngine.js';
import { setDomNodeChildrenFromArrayMapping } from './arrayToDomMapping.js';
import type { ArrayChange } from './compareArrays.js';
import {
  unwrapObservable,
  fixUpContinuousNodeArray,
  replaceDomNodes,
  moveCleanedNodesToContainerElement,
  domNodeIsAttachedToDocument,
} from './utils.js';

function invokeForEachNodeInContinuousRange(
  firstNode: Node,
  lastNode: Node,
  action: (node: Node, nextInRange?: Node) => void,
): void {
  const firstOutOfRange = virtualNextSibling(lastNode);
  let nextInQueue: Node | null = firstNode;
  while (nextInQueue && nextInQueue !== firstOutOfRange) {
    const node = nextInQueue;
    nextInQueue = virtualNextSibling(node);
    action(node, nextInQueue ?? undefined);
  }
}

function activateBindingsOnContinuousNodeArray(
  continuousNodeArray: Node[],
  bindingContext: BindingContext,
): void {
  if (continuousNodeArray.length) {
    let firstNode = continuousNodeArray[0];
    let lastNode = continuousNodeArray[continuousNodeArray.length - 1];
    const parentNode = firstNode.parentNode!;
    const provider = providerInstance;
    const preprocessNode = (provider as { preprocessNode?(node: Node): Node[] | void }).preprocessNode;

    if (preprocessNode) {
      invokeForEachNodeInContinuousRange(firstNode, lastNode, (node, nextNodeInRange) => {
        const nodePreviousSibling = node.previousSibling;
        const newNodes = preprocessNode.call(provider, node);
        if (newNodes) {
          if (node === firstNode)
            firstNode = newNodes[0] || nextNodeInRange!;
          if (node === lastNode)
            lastNode = newNodes[newNodes.length - 1] || nodePreviousSibling!;
        }
      });

      continuousNodeArray.length = 0;
      if (!firstNode) return;
      if (firstNode === lastNode) {
        continuousNodeArray.push(firstNode);
      } else {
        continuousNodeArray.push(firstNode, lastNode);
        fixUpContinuousNodeArray(continuousNodeArray, parentNode);
      }
    }

    invokeForEachNodeInContinuousRange(firstNode, lastNode, (node) => {
      if (node.nodeType === 1 || node.nodeType === 8)
        applyBindings(bindingContext, node);
    });

    fixUpContinuousNodeArray(continuousNodeArray, parentNode);
  }
}

function getFirstNodeFromPossibleArray(nodeOrNodeArray: Node | Node[]): Node | null {
  if ('nodeType' in nodeOrNodeArray && (nodeOrNodeArray as Node).nodeType) {
    return nodeOrNodeArray as Node;
  }
  const arr = nodeOrNodeArray as Node[];
  return arr.length > 0 ? arr[0] : null;
}

function executeTemplate(
  targetNodeOrNodeArray: Node | Node[],
  renderMode: string,
  template: string | Node,
  bindingContext: BindingContext,
  options: TemplateRenderOptions,
): Node[] {
  options = options || {};
  const firstTargetNode = targetNodeOrNodeArray && getFirstNodeFromPossibleArray(targetNodeOrNodeArray);
  const templateDocument = ((firstTargetNode || template) as Node)?.ownerDocument;
  const templateEngineToUse: TemplateEngine = options.templateEngine || getTemplateEngine();
  const renderedNodesArray = templateEngineToUse.renderTemplate(template, bindingContext, options, templateDocument ?? undefined);

  if (typeof renderedNodesArray.length !== 'number' || (renderedNodesArray.length > 0 && typeof renderedNodesArray[0].nodeType !== 'number'))
    throw new Error('Template engine must return an array of DOM nodes');

  let haveAddedNodesToParent = false;
  switch (renderMode) {
    case 'replaceChildren':
      virtualSetChildren(targetNodeOrNodeArray as Node, renderedNodesArray);
      haveAddedNodesToParent = true;
      break;
    case 'replaceNode':
      replaceDomNodes(targetNodeOrNodeArray, renderedNodesArray);
      haveAddedNodesToParent = true;
      break;
    case 'ignoreTargetNode':
      break;
    default:
      throw new Error('Unknown renderMode: ' + renderMode);
  }

  if (haveAddedNodesToParent) {
    activateBindingsOnContinuousNodeArray(renderedNodesArray, bindingContext);
    if (options.afterRender) {
      ignore(() => options.afterRender!(renderedNodesArray, (bindingContext as Record<string, unknown>)[options.as || '$data']));
    }
    if (renderMode === 'replaceChildren') {
      bindingEvent.notify(targetNodeOrNodeArray as Node, bindingEvent.childrenComplete);
    }
  }

  return renderedNodesArray;
}

function resolveTemplateName(
  template: unknown,
  data: unknown,
  context: BindingContext,
): string | Node {
  if (isReadableSubscribable(template)) {
    return template.get() as string | Node;
  } else if (typeof template === 'function') {
    return (template as (data: unknown, context: BindingContext) => string | Node)(data, context);
  } else {
    return template as string | Node;
  }
}

const templateComputedDomDataKey = domDataNextKey();

function disposeOldComputed(element: Node): void {
  const oldComputed = domDataGet(element, templateComputedDomDataKey) as Computed<void> | undefined;
  if (oldComputed && typeof oldComputed.dispose === 'function')
    oldComputed.dispose();
}

function storeNewComputed(element: Node, newComputed: Computed<void> | { dispose(): void } | undefined): void {
  domDataSet(element, templateComputedDomDataKey,
    newComputed && (!('isActive' in newComputed) || (newComputed as Computed<void>).isActive()) ? newComputed : undefined);
}

export function renderTemplate(
  template: unknown,
  dataOrBindingContext: unknown,
  options: TemplateRenderOptions,
  targetNodeOrNodeArray: Node | Node[],
  renderMode?: string,
): Computed<void> {
  options = options || {};
  if ((options.templateEngine || getTemplateEngine()) == null)
    throw new Error('Set a template engine before calling renderTemplate');
  renderMode = renderMode || 'replaceChildren';

  const firstTargetNode = getFirstNodeFromPossibleArray(targetNodeOrNodeArray);
  const whenToDispose = () => !firstTargetNode || !domNodeIsAttachedToDocument(firstTargetNode);
  const activelyDisposeWhenNodeIsRemoved = (firstTargetNode && renderMode === 'replaceNode')
    ? firstTargetNode.parentNode
    : firstTargetNode;

  let currentTargetNodeOrNodeArray = targetNodeOrNodeArray;

  const computed = new Computed<void>(() => {
    const bindingContext = (dataOrBindingContext instanceof BindingContext)
      ? dataOrBindingContext
      : new BindingContext(dataOrBindingContext, undefined, undefined, undefined, { exportDependencies: true });

    const templateName = resolveTemplateName(template, bindingContext.$data, bindingContext);
    const renderedNodesArray = executeTemplate(currentTargetNodeOrNodeArray, renderMode!, templateName, bindingContext, options);

    if (renderMode === 'replaceNode') {
      currentTargetNodeOrNodeArray = renderedNodesArray;
    }
  });

  if (activelyDisposeWhenNodeIsRemoved) {
    addDisposeCallback(activelyDisposeWhenNodeIsRemoved, () => computed.dispose());
  }

  // Also add a check to dispose when detached from DOM
  const sub = computed.subscribe(() => {
    if (whenToDispose()) {
      computed.dispose();
      sub.dispose();
    }
  });

  return computed;
}

export function renderTemplateForEach(
  template: unknown,
  arrayOrObservableArray: unknown,
  options: TemplateRenderOptions,
  targetNode: Node,
  parentBindingContext: BindingContext,
): { dispose(): void } {
  let arrayItemContext: BindingContext | null;
  const asName = options.as;

  const executeTemplateForArrayItem = (arrayValue: unknown, index: unknown) => {
    arrayItemContext = parentBindingContext.createChildContext(arrayValue, {
      as: asName,
      noChildContext: options.noChildContext,
      extend(context: BindingContext) {
        context.$index = index;
        if (asName) {
          context[asName + 'Index'] = index;
        }
      },
    });

    const templateName = resolveTemplateName(template, arrayValue, arrayItemContext);
    return executeTemplate(targetNode, 'ignoreTargetNode', templateName, arrayItemContext, options);
  };

  const activateBindingsCallback = (arrayValue: unknown, addedNodesArray: Node[]) => {
    activateBindingsOnContinuousNodeArray(addedNodesArray, arrayItemContext!);
    if (options.afterRender)
      options.afterRender(addedNodesArray, arrayValue);
    arrayItemContext = null;
  };

  const setDomNodeChildrenFromArrayMappingCb = (newArray: unknown[], changeList?: ArrayChange<unknown>[]) => {
    ignore(() => setDomNodeChildrenFromArrayMapping(
      targetNode, newArray, executeTemplateForArrayItem as never, options, activateBindingsCallback as never, changeList,
    ));
    bindingEvent.notify(targetNode, bindingEvent.childrenComplete);
  };

  const shouldHideDestroyed = (options.includeDestroyed === false);

  if (!shouldHideDestroyed && !options.beforeRemove && isObservableArray(arrayOrObservableArray)) {
    const observableArray = arrayOrObservableArray as ObservableArray<unknown>;
    const queuedChangeLists: ArrayChange<unknown>[][] = [];
    let isProcessing = false;

    function processArrayChange(changeList?: ArrayChange<unknown>[]): void {
      if (changeList) queuedChangeLists.push(changeList);
      if (isProcessing) return;
      isProcessing = true;
      try {
        if (queuedChangeLists.length === 0) {
          setDomNodeChildrenFromArrayMappingCb(observableArray.peek());
        } else {
          while (queuedChangeLists.length) {
            const cl = queuedChangeLists.shift()!;
            try {
              setDomNodeChildrenFromArrayMappingCb(observableArray.peek(), cl);
            } catch (e) {
              // allow processing to continue
              if (queuedChangeLists.length === 0) throw e;
            }
          }
        }
      } finally {
        isProcessing = false;
      }
    }

    const subscription = observableArray.subscribe(
      processArrayChange as (value: unknown) => void,
      'arrayChange',
    );
    addDisposeCallback(targetNode, () => subscription.dispose());

    processArrayChange();
    return subscription;
  } else {
    const computed = new Computed<void>(() => {
      let unwrappedArray = unwrapObservable(arrayOrObservableArray) as unknown[] || [];
      if (!Array.isArray(unwrappedArray)) {
        unwrappedArray = [unwrappedArray];
      }

      if (shouldHideDestroyed) {
        unwrappedArray = (unwrappedArray as Record<string, unknown>[]).filter(
          item => item === undefined || item === null || !unwrapObservable(item._destroy),
        );
      }
      setDomNodeChildrenFromArrayMappingCb(unwrappedArray);
    });

    addDisposeCallback(targetNode, () => computed.dispose());
    return computed;
  }
}

// ---- template binding handler ----

const cleanContainerDomDataKey = domDataNextKey();

const templateHandler: BindingHandler = {
  init(element, valueAccessor) {
    const bindingValue = unwrapObservable(valueAccessor());
    if (typeof bindingValue === 'string' || (bindingValue && typeof bindingValue === 'object' && 'name' in (bindingValue as Record<string, unknown>))) {
      virtualEmptyNode(element);
    } else if (bindingValue && typeof bindingValue === 'object' && 'nodes' in (bindingValue as Record<string, unknown>)) {
      const nodes = (bindingValue as Record<string, unknown>).nodes as Node[] || [];
      if (isReadableSubscribable(nodes)) {
        throw new Error('The "nodes" option must be a plain, non-observable array.');
      }

      let container = nodes[0]?.parentNode as HTMLElement | undefined;
      if (!container || !domDataGet(container, cleanContainerDomDataKey)) {
        container = moveCleanedNodesToContainerElement(nodes);
        domDataSet(container, cleanContainerDomDataKey, true);
      }

      new AnonymousSource(element as Element).nodes(container);
    } else {
      const templateNodes = virtualChildNodes(element);
      if (templateNodes.length > 0) {
        const container = moveCleanedNodesToContainerElement(templateNodes);
        new AnonymousSource(element as Element).nodes(container);
      } else {
        throw new Error('Anonymous template defined, but no template content was provided');
      }
    }
    return { controlsDescendantBindings: true };
  },

  update(element, valueAccessor, allBindings, viewModel, bindingContext) {
    const value = valueAccessor();
    let options = unwrapObservable(value) as TemplateRenderOptions & Record<string, unknown>;
    let shouldDisplay = true;
    let templateComputed: { dispose(): void } | undefined;
    let template: unknown;

    if (typeof options === 'string') {
      template = value;
      options = {};
    } else {
      template = 'name' in options ? options.name : element;

      if ('if' in options)
        shouldDisplay = !!unwrapObservable(options['if']);
      if (shouldDisplay && 'ifnot' in options)
        shouldDisplay = !unwrapObservable(options.ifnot);
    }

    if (shouldDisplay && !template) {
      shouldDisplay = false;
    }

    disposeOldComputed(element);

    if ('foreach' in options) {
      const dataArray = (shouldDisplay && options.foreach) || [];
      templateComputed = renderTemplateForEach(template, dataArray, options, element, bindingContext!);
    } else if (!shouldDisplay) {
      virtualEmptyNode(element);
    } else {
      let innerBindingContext = bindingContext!;
      if ('data' in options) {
        innerBindingContext = bindingContext!.createChildContext(options.data, {
          as: options.as,
          noChildContext: options.noChildContext,
          exportDependencies: true,
        });
      }
      templateComputed = renderTemplate(template, innerBindingContext, options, element);
    }

    storeNewComputed(element, templateComputed as Computed<void> | undefined);
  },
};

bindingHandlers['template'] = templateHandler;
allowedVirtualElementBindings['template'] = true;
