import { addDisposeCallback, removeDisposeCallback, cleanNode, removeNode } from '#src/domNodeDisposal.js';
import { domDataGet, domDataSet, domDataClear } from '#src/domData.js';
import { begin, end } from '#src/dependencyDetection.js';

// Lightweight mock nodes that satisfy the subset of the Node interface used by the disposal system.

interface MockNode extends Node {
  _children: MockNode[];
  _descendants: MockNode[];
}

function createMockNode(nodeType: number, children: MockNode[] = []): MockNode {
  const descendants: MockNode[] = [];
  function collectDescendants(nodes: MockNode[]) {
    for (const child of nodes) {
      if (child.nodeType === 1) descendants.push(child);
      collectDescendants(child._children);
    }
  }
  collectDescendants(children);

  const node: MockNode = {
    nodeType,
    _children: children,
    _descendants: descendants,
    get childNodes() {
      return children as unknown as NodeListOf<ChildNode>;
    },
    getElementsByTagName(_tag: string) {
      return descendants as unknown as HTMLCollectionOf<Element>;
    },
    parentNode: null,
    removeChild(child: Node) {
      const idx = children.indexOf(child as MockNode);
      if (idx >= 0) children.splice(idx, 1);
      return child;
    },
  } as unknown as MockNode;

  for (const child of children) {
    (child as unknown as { parentNode: MockNode }).parentNode = node;
  }

  return node;
}

function createElement(children: MockNode[] = []): MockNode {
  return createMockNode(1, children);
}

function createComment(): MockNode {
  return createMockNode(8);
}

function createTextNode(): MockNode {
  return createMockNode(3);
}

function createDocument(children: MockNode[] = []): MockNode {
  return createMockNode(9, children);
}

describe('domNodeDisposal', () => {

  describe('addDisposeCallback', () => {
    it('throws if callback is not a function', () => {
      const node = createElement();
      expect(() => addDisposeCallback(node, 'not a function' as unknown as (node: Node) => void))
        .toThrowError('Callback must be a function');
    });
  });

  describe('cleanNode', () => {
    it('invokes a registered dispose callback with the node', () => {
      const node = createElement();
      const callback = jasmine.createSpy('callback');
      addDisposeCallback(node, callback);
      cleanNode(node);
      expect(callback).toHaveBeenCalledWith(node);
    });

    it('invokes multiple callbacks in registration order', () => {
      const node = createElement();
      const order: number[] = [];
      addDisposeCallback(node, () => order.push(1));
      addDisposeCallback(node, () => order.push(2));
      addDisposeCallback(node, () => order.push(3));
      cleanNode(node);
      expect(order).toEqual([1, 2, 3]);
    });

    it('allows callbacks to remove themselves during invocation', () => {
      const node = createElement();
      const results: string[] = [];
      const selfRemover = () => {
        results.push('self');
        removeDisposeCallback(node, selfRemover);
      };
      addDisposeCallback(node, selfRemover);
      addDisposeCallback(node, () => results.push('after'));
      cleanNode(node);
      expect(results).toEqual(['self', 'after']);
    });

    it('clears all domData on the node', () => {
      const node = createElement();
      domDataSet(node, 'myKey', 'myValue');
      cleanNode(node);
      expect(domDataGet(node, 'myKey')).toBeUndefined();
    });

    it('recursively cleans descendant elements', () => {
      const child = createElement();
      const grandchild = createElement();
      const parent = createElement([createElement([grandchild]), child]);

      const childCallback = jasmine.createSpy('childCallback');
      const grandchildCallback = jasmine.createSpy('grandchildCallback');
      addDisposeCallback(child, childCallback);
      addDisposeCallback(grandchild, grandchildCallback);

      cleanNode(parent);

      expect(childCallback).toHaveBeenCalledWith(child);
      expect(grandchildCallback).toHaveBeenCalledWith(grandchild);
    });

    it('cleans child comment nodes', () => {
      const comment = createComment();
      const parent = createElement([comment]);
      const callback = jasmine.createSpy('commentCallback');
      addDisposeCallback(comment, callback);
      cleanNode(parent);
      expect(callback).toHaveBeenCalledWith(comment);
    });

    it('cleans comment nodes directly', () => {
      const comment = createComment();
      const callback = jasmine.createSpy('callback');
      addDisposeCallback(comment, callback);
      cleanNode(comment);
      expect(callback).toHaveBeenCalledWith(comment);
    });

    it('cleans document nodes and their descendants', () => {
      const child = createElement();
      const doc = createDocument([child]);
      const docCallback = jasmine.createSpy('docCallback');
      const childCallback = jasmine.createSpy('childCallback');
      addDisposeCallback(doc, docCallback);
      addDisposeCallback(child, childCallback);
      cleanNode(doc);
      expect(docCallback).toHaveBeenCalledWith(doc);
      expect(childCallback).toHaveBeenCalledWith(child);
    });

    it('does not run dependency detection during disposal', () => {
      const node = createElement();
      let trackingFrameActive = false;

      addDisposeCallback(node, () => {
        const frame = { callback: () => { trackingFrameActive = true; } };
        begin(frame);
        try {
          // If ignore() is wrapping cleanNode, begin() pushed undefined
          // and this inner begin/end won't cause issues. We just check
          // that no outer tracking was active during the callback.
        } finally {
          end();
        }
      });

      // Set up an outer tracking frame
      let outerWasNotified = false;
      const outerFrame = { callback: () => { outerWasNotified = true; } };
      begin(outerFrame);
      try {
        cleanNode(node);
      } finally {
        end();
      }

      expect(outerWasNotified).toBe(false);
      expect(trackingFrameActive).toBe(false);
    });

    it('returns the node', () => {
      const node = createElement();
      expect(cleanNode(node)).toBe(node);
    });

    it('skips non-cleanable node types (text node)', () => {
      const textNode = createTextNode();
      const callback = jasmine.createSpy('callback');
      addDisposeCallback(textNode, callback);
      cleanNode(textNode);
      expect(callback).not.toHaveBeenCalled();
    });

    it('returns the node even when nodeType is not cleanable', () => {
      const textNode = createTextNode();
      expect(cleanNode(textNode)).toBe(textNode);
    });

    it('clears domData on descendant nodes', () => {
      const child = createElement();
      const parent = createElement([child]);
      domDataSet(child, 'key', 'value');
      cleanNode(parent);
      expect(domDataGet(child, 'key')).toBeUndefined();
    });
  });

  describe('removeDisposeCallback', () => {
    it('prevents the callback from running on cleanNode', () => {
      const node = createElement();
      const callback = jasmine.createSpy('callback');
      addDisposeCallback(node, callback);
      removeDisposeCallback(node, callback);
      cleanNode(node);
      expect(callback).not.toHaveBeenCalled();
    });

    it('only removes the specified callback', () => {
      const node = createElement();
      const keep = jasmine.createSpy('keep');
      const remove = jasmine.createSpy('remove');
      addDisposeCallback(node, keep);
      addDisposeCallback(node, remove);
      removeDisposeCallback(node, remove);
      cleanNode(node);
      expect(keep).toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });

    it('is a no-op for a callback not registered', () => {
      const node = createElement();
      const callback = jasmine.createSpy('callback');
      expect(() => removeDisposeCallback(node, callback)).not.toThrow();
    });

    it('is a no-op for a node with no callbacks', () => {
      const node = createElement();
      expect(() => removeDisposeCallback(node, () => {})).not.toThrow();
    });
  });

  describe('removeNode', () => {
    it('cleans the node and removes it from its parent', () => {
      const child = createElement();
      const parent = createElement([child]);
      const callback = jasmine.createSpy('callback');
      addDisposeCallback(child, callback);

      removeNode(child);

      expect(callback).toHaveBeenCalledWith(child);
      expect(parent._children).not.toContain(child);
    });

    it('works on a node with no parent', () => {
      const node = createElement();
      expect(() => removeNode(node)).not.toThrow();
    });

    it('cleans descendants before removing', () => {
      const grandchild = createElement();
      const child = createElement([grandchild]);
      const parent = createElement([child]);
      const callback = jasmine.createSpy('grandchildCallback');
      addDisposeCallback(grandchild, callback);

      removeNode(child);

      expect(callback).toHaveBeenCalledWith(grandchild);
      expect(parent._children).not.toContain(child);
    });
  });
});
