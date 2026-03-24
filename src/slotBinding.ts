import type { BindingHandler } from './bindingProvider.js';
import { bindingHandlers } from './bindingProvider.js';
import type { BindingContext } from './bindingContext.js';
import { applyBindingsToDescendants } from './applyBindings.js';
import {
  allowedVirtualElementBindings,
  virtualChildNodes,
  virtualSetChildren,
} from './virtualElements.js';
import { cloneNodes } from './utilsDom.js';

const DEFAULT_SLOT = '';

function partitionTemplateNodes(
  templateNodes: Node[],
): { defaultNodes: Node[]; namedSlots: Map<string, Node[]> } {
  const namedSlots = new Map<string, Node[]>();
  const defaultNodes: Node[] = [];

  for (const node of templateNodes) {
    const slotAttr = node.nodeType === 1
      ? (node as Element).getAttribute('slot')
      : null;

    if (slotAttr) {
      let bucket = namedSlots.get(slotAttr);
      if (!bucket) {
        bucket = [];
        namedSlots.set(slotAttr, bucket);
      }
      bucket.push(node);
    } else {
      defaultNodes.push(node);
    }
  }

  return { defaultNodes, namedSlots };
}

const slotHandler: BindingHandler = {
  init(element, valueAccessor, _allBindings, _viewModel, bindingContext) {
    const slotName = valueAccessor() as string | undefined;
    const name = (typeof slotName === 'string' ? slotName : DEFAULT_SLOT);

    const templateNodes = (bindingContext as BindingContext & { $componentTemplateNodes?: Node[] })
      .$componentTemplateNodes;

    if (!templateNodes || templateNodes.length === 0) {
      applyBindingsToDescendants(bindingContext, element);
      return { controlsDescendantBindings: true };
    }

    const { defaultNodes, namedSlots } = partitionTemplateNodes(templateNodes);
    const matchingNodes = name === DEFAULT_SLOT ? defaultNodes : (namedSlots.get(name) || []);

    if (matchingNodes.length === 0) {
      applyBindingsToDescendants(bindingContext, element);
      return { controlsDescendantBindings: true };
    }

    const cloned = cloneNodes(matchingNodes);
    virtualSetChildren(element, cloned);

    const parentContext = findParentOuterContext(bindingContext);
    applyBindingsToDescendants(parentContext, element);

    return { controlsDescendantBindings: true };
  },
};

/**
 * Walk up the context chain to find the outer (pre-component) context.
 * The component binding creates a child context with $component set,
 * so we look for the context just above that boundary.
 */
function findParentOuterContext(bindingContext: BindingContext): BindingContext {
  if (bindingContext.$parentContext && '$component' in bindingContext) {
    return bindingContext.$parentContext;
  }
  return bindingContext;
}

bindingHandlers['slot'] = slotHandler;
allowedVirtualElementBindings['slot'] = true;
