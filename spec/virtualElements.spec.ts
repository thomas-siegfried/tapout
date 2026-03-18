import { Window } from 'happy-dom';
import {
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
} from '#src/virtualElements.js';
import { addDisposeCallback } from '#src/domNodeDisposal.js';

const window = new Window();
const document = window.document;

function createComment(text: string): Comment {
  return document.createComment(text) as unknown as Comment;
}

function createElement(tag: string, ...children: Node[]): HTMLElement {
  const el = document.createElement(tag);
  for (const child of children) el.appendChild(child as never);
  return el as unknown as HTMLElement;
}

function createText(text: string): Text {
  return document.createTextNode(text) as unknown as Text;
}

function buildVirtualContainer(bindingExpr: string, ...children: Node[]): { start: Comment; end: Comment; container: HTMLElement } {
  const start = createComment(` tap ${bindingExpr} `);
  const end = createComment(' /tap ');
  const container = createElement('div', start, ...children, end);
  return { start, end, container };
}

describe('virtualElements', () => {

  describe('isStartComment / hasBindingValue', () => {
    it('identifies <!-- tap ... --> as a start comment', () => {
      const comment = createComment(' tap foreach: items ');
      expect(isStartComment(comment)).toBe(true);
      expect(hasBindingValue(comment)).toBe(true);
    });

    it('identifies <!-- tap --> with no binding expression', () => {
      const comment = createComment(' tap ');
      expect(isStartComment(comment)).toBe(true);
    });

    it('rejects a regular comment', () => {
      const comment = createComment(' this is a regular comment ');
      expect(isStartComment(comment)).toBe(false);
      expect(hasBindingValue(comment)).toBe(false);
    });

    it('rejects an end comment', () => {
      const comment = createComment(' /tap ');
      expect(isStartComment(comment)).toBe(false);
    });

    it('rejects an element node', () => {
      const el = createElement('div');
      expect(isStartComment(el)).toBe(false);
    });

    it('handles minimal whitespace', () => {
      const comment = createComment('tap text: name');
      expect(isStartComment(comment)).toBe(true);
    });
  });

  describe('virtualNodeBindingValue', () => {
    it('extracts the binding expression from a start comment', () => {
      const comment = createComment(' tap foreach: items ');
      expect(virtualNodeBindingValue(comment)).toBe('foreach: items');
    });

    it('returns null for a non-start comment', () => {
      const comment = createComment(' /tap ');
      expect(virtualNodeBindingValue(comment)).toBeNull();
    });

    it('returns null for a regular comment', () => {
      const comment = createComment(' some comment ');
      expect(virtualNodeBindingValue(comment)).toBeNull();
    });

    it('handles multiline binding expressions', () => {
      const comment = createComment(' tap foreach: {\n  data: items,\n  as: "item"\n} ');
      const value = virtualNodeBindingValue(comment);
      expect(value).toContain('foreach');
      expect(value).toContain('items');
    });
  });

  describe('virtualChildNodes', () => {
    it('returns real childNodes for a regular element', () => {
      const child1 = createElement('span');
      const child2 = createElement('span');
      const parent = createElement('div', child1, child2);
      const result = virtualChildNodes(parent);
      expect(result.length).toBe(2);
      expect(result[0]).toBe(child1);
      expect(result[1]).toBe(child2);
    });

    it('returns virtual children for a start comment', () => {
      const span = createElement('span');
      const text = createText('hello');
      const { start } = buildVirtualContainer('foreach: items', span, text);
      const result = virtualChildNodes(start);
      expect(result.length).toBe(2);
      expect(result[0]).toBe(span);
      expect(result[1]).toBe(text);
    });

    it('returns empty array for an empty virtual container', () => {
      const { start } = buildVirtualContainer('if: show');
      const result = virtualChildNodes(start);
      expect(result.length).toBe(0);
    });

    it('handles nested virtual elements', () => {
      const innerStart = createComment(' tap text: name ');
      const innerSpan = createElement('span');
      const innerEnd = createComment(' /tap ');
      const { start } = buildVirtualContainer('foreach: items', innerStart, innerSpan, innerEnd);
      const result = virtualChildNodes(start);
      expect(result.length).toBe(3);
      expect(result[0]).toBe(innerStart);
      expect(result[1]).toBe(innerSpan);
      expect(result[2]).toBe(innerEnd);
    });

    it('throws on unbalanced comment tags', () => {
      const start = createComment(' tap foreach: items ');
      const container = createElement('div', start);
      expect(() => virtualChildNodes(start)).toThrowError(/Cannot find closing comment tag/);
    });
  });

  describe('virtualFirstChild', () => {
    it('returns the first child of a regular element', () => {
      const child = createElement('span');
      const parent = createElement('div', child);
      expect(virtualFirstChild(parent)).toBe(child);
    });

    it('returns null for an empty element', () => {
      const parent = createElement('div');
      expect(virtualFirstChild(parent)).toBeNull();
    });

    it('returns the first virtual child for a start comment', () => {
      const span = createElement('span');
      const { start } = buildVirtualContainer('if: show', span);
      expect(virtualFirstChild(start)).toBe(span);
    });

    it('returns null for an empty virtual container', () => {
      const { start } = buildVirtualContainer('if: show');
      expect(virtualFirstChild(start)).toBeNull();
    });

    it('skips a stray end comment as first child of an element', () => {
      const endComment = createComment(' /tap ');
      const span = createElement('span');
      const parent = createElement('div', endComment, span);
      expect(virtualFirstChild(parent)).toBe(span);
    });
  });

  describe('virtualNextSibling', () => {
    it('returns the next sibling of a regular node', () => {
      const first = createElement('span');
      const second = createElement('span');
      createElement('div', first, second);
      expect(virtualNextSibling(first)).toBe(second);
    });

    it('returns null at the end of children', () => {
      const child = createElement('span');
      createElement('div', child);
      expect(virtualNextSibling(child)).toBeNull();
    });

    it('skips over a nested virtual element block', () => {
      const innerStart = createComment(' tap text: name ');
      const innerSpan = createElement('span');
      const innerEnd = createComment(' /tap ');
      const afterInner = createElement('div');
      createElement('div', innerStart, innerSpan, innerEnd, afterInner);
      expect(virtualNextSibling(innerStart)).toBe(afterInner);
    });

    it('returns null when next sibling is an end comment (virtual boundary)', () => {
      const span = createElement('span');
      const { start } = buildVirtualContainer('foreach: items', span);
      expect(virtualNextSibling(span)).toBeNull();
    });

    it('handles consecutive virtual elements', () => {
      const start1 = createComment(' tap text: a ');
      const end1 = createComment(' /tap ');
      const start2 = createComment(' tap text: b ');
      const end2 = createComment(' /tap ');
      createElement('div', start1, end1, start2, end2);
      expect(virtualNextSibling(start1)).toBe(start2);
    });
  });

  describe('virtualEmptyNode', () => {
    it('removes all children from a regular element', () => {
      const parent = createElement('div', createElement('span'), createElement('span'));
      virtualEmptyNode(parent);
      expect(parent.childNodes.length).toBe(0);
    });

    it('removes all virtual children from a comment container', () => {
      const span = createElement('span');
      const text = createText('hello');
      const { start, end, container } = buildVirtualContainer('foreach: items', span, text);
      virtualEmptyNode(start);
      expect(container.childNodes.length).toBe(2);
      expect(container.childNodes[0]).toBe(start);
      expect(container.childNodes[1]).toBe(end);
    });

    it('runs dispose callbacks on removed nodes', () => {
      const child = createElement('span');
      const parent = createElement('div', child);
      const callback = jasmine.createSpy('dispose');
      addDisposeCallback(child, callback);
      virtualEmptyNode(parent);
      expect(callback).toHaveBeenCalledWith(child);
    });

    it('is a no-op for an empty virtual container', () => {
      const { start, end, container } = buildVirtualContainer('if: show');
      virtualEmptyNode(start);
      expect(container.childNodes.length).toBe(2);
      expect(container.childNodes[0]).toBe(start);
      expect(container.childNodes[1]).toBe(end);
    });
  });

  describe('virtualSetChildren', () => {
    it('replaces children of a regular element', () => {
      const parent = createElement('div', createElement('span'));
      const newChild1 = createElement('p');
      const newChild2 = createElement('p');
      virtualSetChildren(parent, [newChild1, newChild2]);
      expect(parent.childNodes.length).toBe(2);
      expect(parent.childNodes[0]).toBe(newChild1);
      expect(parent.childNodes[1]).toBe(newChild2);
    });

    it('replaces virtual children in a comment container', () => {
      const oldChild = createElement('span');
      const { start, end, container } = buildVirtualContainer('foreach: items', oldChild);
      const newChild = createElement('p');
      virtualSetChildren(start, [newChild]);
      expect(container.childNodes.length).toBe(3);
      expect(container.childNodes[0]).toBe(start);
      expect(container.childNodes[1]).toBe(newChild);
      expect(container.childNodes[2]).toBe(end);
    });

    it('can set empty children on a virtual container', () => {
      const { start, end, container } = buildVirtualContainer('if: show', createElement('span'));
      virtualSetChildren(start, []);
      expect(container.childNodes.length).toBe(2);
      expect(container.childNodes[0]).toBe(start);
      expect(container.childNodes[1]).toBe(end);
    });
  });

  describe('virtualPrepend', () => {
    it('prepends to a regular element', () => {
      const existing = createElement('span');
      const parent = createElement('div', existing);
      const newNode = createElement('p');
      virtualPrepend(parent, newNode);
      expect(parent.childNodes[0]).toBe(newNode);
      expect(parent.childNodes[1]).toBe(existing);
    });

    it('prepends to an empty element', () => {
      const parent = createElement('div');
      const newNode = createElement('span');
      virtualPrepend(parent, newNode);
      expect(parent.childNodes[0]).toBe(newNode);
    });

    it('prepends to a virtual container (inserts after start comment)', () => {
      const existing = createElement('span');
      const { start, container } = buildVirtualContainer('foreach: items', existing);
      const newNode = createElement('p');
      virtualPrepend(start, newNode);
      expect(container.childNodes[0]).toBe(start);
      expect(container.childNodes[1]).toBe(newNode);
      expect(container.childNodes[2]).toBe(existing);
    });

    it('prepends to an empty virtual container', () => {
      const { start, end, container } = buildVirtualContainer('if: show');
      const newNode = createElement('span');
      virtualPrepend(start, newNode);
      expect(container.childNodes[0]).toBe(start);
      expect(container.childNodes[1]).toBe(newNode);
      expect(container.childNodes[2]).toBe(end);
    });
  });

  describe('virtualInsertAfter', () => {
    it('inserts after a reference node in a regular element', () => {
      const first = createElement('span');
      const second = createElement('span');
      const parent = createElement('div', first, second);
      const newNode = createElement('p');
      virtualInsertAfter(parent, newNode, first);
      expect(parent.childNodes[0]).toBe(first);
      expect(parent.childNodes[1]).toBe(newNode);
      expect(parent.childNodes[2]).toBe(second);
    });

    it('appends when insertAfterNode is the last child', () => {
      const child = createElement('span');
      const parent = createElement('div', child);
      const newNode = createElement('p');
      virtualInsertAfter(parent, newNode, child);
      expect(parent.childNodes[1]).toBe(newNode);
    });

    it('prepends when insertAfterNode is null', () => {
      const existing = createElement('span');
      const parent = createElement('div', existing);
      const newNode = createElement('p');
      virtualInsertAfter(parent, newNode, null);
      expect(parent.childNodes[0]).toBe(newNode);
    });

    it('inserts after a reference node in a virtual container', () => {
      const first = createElement('span');
      const second = createElement('span');
      const { start, end, container } = buildVirtualContainer('foreach: items', first, second);
      const newNode = createElement('p');
      virtualInsertAfter(start, newNode, first);
      expect(container.childNodes[1]).toBe(first);
      expect(container.childNodes[2]).toBe(newNode);
      expect(container.childNodes[3]).toBe(second);
    });

    it('inserts at end of virtual container (before end comment)', () => {
      const child = createElement('span');
      const { start, end, container } = buildVirtualContainer('foreach: items', child);
      const newNode = createElement('p');
      virtualInsertAfter(start, newNode, child);
      expect(container.childNodes[2]).toBe(newNode);
      expect(container.childNodes[3]).toBe(end);
    });
  });

  describe('allowedVirtualElementBindings', () => {
    it('is an initially empty object', () => {
      expect(typeof allowedVirtualElementBindings).toBe('object');
    });

    it('can register bindings', () => {
      allowedVirtualElementBindings['testBinding'] = true;
      expect(allowedVirtualElementBindings['testBinding']).toBe(true);
      delete allowedVirtualElementBindings['testBinding'];
    });
  });

  describe('nested virtual elements', () => {
    it('traverses nested virtual elements correctly with firstChild/nextSibling', () => {
      const innerStart = createComment(' tap text: name ');
      const innerSpan = createElement('span');
      const innerEnd = createComment(' /tap ');
      const outerSpan = createElement('div');
      const { start } = buildVirtualContainer('foreach: items', innerStart, innerSpan, innerEnd, outerSpan);

      const first = virtualFirstChild(start);
      expect(first).toBe(innerStart);

      const second = virtualNextSibling(first!);
      expect(second).toBe(outerSpan);

      const third = virtualNextSibling(second!);
      expect(third).toBeNull();
    });

    it('virtualChildNodes of inner virtual element returns its children', () => {
      const innerStart = createComment(' tap text: name ');
      const innerSpan = createElement('span');
      const innerEnd = createComment(' /tap ');
      buildVirtualContainer('foreach: items', innerStart, innerSpan, innerEnd);

      const innerChildren = virtualChildNodes(innerStart);
      expect(innerChildren.length).toBe(1);
      expect(innerChildren[0]).toBe(innerSpan);
    });
  });
});
