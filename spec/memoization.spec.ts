import { Window } from 'happy-dom';
import { memoization } from '#src/index.js';

const window = new Window();
const document = window.document;

function createElement(tag: string, ...children: (Node | string)[]): Element {
  const el = document.createElement(tag);
  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child) as never);
    } else {
      el.appendChild(child as never);
    }
  }
  return el as unknown as Element;
}

describe('memoization', () => {
  describe('memoize', () => {
    it('returns a comment string containing a memo ID', () => {
      const result = memoization.memoize(() => {});
      expect(result).toMatch(/^<!--\[tap_memo:[0-9a-f]+\]-->$/);
    });

    it('generates unique IDs for each call', () => {
      const a = memoization.memoize(() => {});
      const b = memoization.memoize(() => {});
      expect(a).not.toBe(b);

      // unmemoize so they don't leak
      const idA = memoization.parseMemoText(a.replace('<!--', '').replace('-->', ''));
      const idB = memoization.parseMemoText(b.replace('<!--', '').replace('-->', ''));
      if (idA) memoization.unmemoize(idA);
      if (idB) memoization.unmemoize(idB);
    });

    it('throws if passed a non-function', () => {
      expect(() => memoization.memoize('not a function' as never)).toThrowError(/function/);
    });
  });

  describe('parseMemoText', () => {
    it('extracts memo ID from valid memo text', () => {
      const id = memoization.parseMemoText('[tap_memo:abc123def456]');
      expect(id).toBe('abc123def456');
    });

    it('returns null for non-memo text', () => {
      expect(memoization.parseMemoText('some random text')).toBeNull();
      expect(memoization.parseMemoText('')).toBeNull();
      expect(memoization.parseMemoText('[ko_memo:abc]')).toBeNull();
    });

    it('returns null for partial matches', () => {
      expect(memoization.parseMemoText('[tap_memo:abc] extra')).toBeNull();
      expect(memoization.parseMemoText('prefix [tap_memo:abc]')).toBeNull();
    });
  });

  describe('unmemoize', () => {
    it('calls the memoized callback with provided params', () => {
      const spy = jasmine.createSpy('memoCallback');
      const commentStr = memoization.memoize(spy);
      const id = memoization.parseMemoText(commentStr.replace('<!--', '').replace('-->', ''))!;

      expect(id).toBeTruthy();
      memoization.unmemoize(id, ['arg1', 42]);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('arg1', 42);
    });

    it('returns true on success', () => {
      const commentStr = memoization.memoize(() => {});
      const id = memoization.parseMemoText(commentStr.replace('<!--', '').replace('-->', ''))!;
      expect(memoization.unmemoize(id)).toBe(true);
    });

    it('throws for unknown memo ID', () => {
      expect(() => memoization.unmemoize('nonexistent')).toThrowError(/Couldn't find any memo/);
    });

    it('throws if unmemoized twice', () => {
      const commentStr = memoization.memoize(() => {});
      const id = memoization.parseMemoText(commentStr.replace('<!--', '').replace('-->', ''))!;
      memoization.unmemoize(id);
      expect(() => memoization.unmemoize(id)).toThrowError(/already been unmemoized/);
    });

    it('calls callback with empty array if no params given', () => {
      const spy = jasmine.createSpy('memoCallback');
      const commentStr = memoization.memoize(spy);
      const id = memoization.parseMemoText(commentStr.replace('<!--', '').replace('-->', ''))!;
      memoization.unmemoize(id);
      expect(spy).toHaveBeenCalledWith();
    });
  });

  describe('unmemoizeDomNodeAndDescendants', () => {
    it('finds and unmemoizes comment nodes in a DOM tree', () => {
      const spy = jasmine.createSpy('memoCallback');
      const commentStr = memoization.memoize(spy);
      const id = memoization.parseMemoText(commentStr.replace('<!--', '').replace('-->', ''))!;

      const container = createElement('div');
      const comment = document.createComment('[tap_memo:' + id + ']') as unknown as Comment;
      container.appendChild(comment as never);

      memoization.unmemoizeDomNodeAndDescendants(container, ['extra']);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.calls.argsFor(0)[0]).toBe(comment);
      expect(spy.calls.argsFor(0)[1]).toBe('extra');
    });

    it('removes memo comment nodes from the DOM after unmemoizing', () => {
      const commentStr = memoization.memoize(() => {});
      const id = memoization.parseMemoText(commentStr.replace('<!--', '').replace('-->', ''))!;

      const container = createElement('div');
      const comment = document.createComment('[tap_memo:' + id + ']') as unknown as Comment;
      container.appendChild(comment as never);

      expect(container.childNodes.length).toBe(1);
      memoization.unmemoizeDomNodeAndDescendants(container);
      expect(container.childNodes.length).toBe(0);
    });

    it('processes nested memo comments', () => {
      const spy1 = jasmine.createSpy('memo1');
      const spy2 = jasmine.createSpy('memo2');
      const cs1 = memoization.memoize(spy1);
      const cs2 = memoization.memoize(spy2);
      const id1 = memoization.parseMemoText(cs1.replace('<!--', '').replace('-->', ''))!;
      const id2 = memoization.parseMemoText(cs2.replace('<!--', '').replace('-->', ''))!;

      const container = createElement('div');
      const inner = createElement('span');
      inner.appendChild(document.createComment('[tap_memo:' + id1 + ']') as never);
      container.appendChild(inner as never);
      container.appendChild(document.createComment('[tap_memo:' + id2 + ']') as never);

      memoization.unmemoizeDomNodeAndDescendants(container);

      expect(spy1).toHaveBeenCalledTimes(1);
      expect(spy2).toHaveBeenCalledTimes(1);
    });

    it('ignores non-memo comment nodes', () => {
      const container = createElement('div');
      container.appendChild(document.createComment('just a regular comment') as never);
      container.appendChild(document.createComment(' tap binding ') as never);

      // Should not throw
      memoization.unmemoizeDomNodeAndDescendants(container);
      expect(container.childNodes.length).toBe(2);
    });

    it('handles a comment node passed directly (nodeType 8)', () => {
      const spy = jasmine.createSpy('memoCallback');
      const commentStr = memoization.memoize(spy);
      const id = memoization.parseMemoText(commentStr.replace('<!--', '').replace('-->', ''))!;

      const container = createElement('div');
      const comment = document.createComment('[tap_memo:' + id + ']') as unknown as Comment;
      container.appendChild(comment as never);

      memoization.unmemoizeDomNodeAndDescendants(comment);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('neutering prevents double unmemoization', () => {
      const spy = jasmine.createSpy('memoCallback');
      const commentStr = memoization.memoize(spy);
      const id = memoization.parseMemoText(commentStr.replace('<!--', '').replace('-->', ''))!;

      const container = createElement('div');
      const comment = document.createComment('[tap_memo:' + id + ']') as unknown as Comment;
      container.appendChild(comment as never);

      memoization.unmemoizeDomNodeAndDescendants(container);

      // After unmemoize, nodeValue is neutered to '' so parseMemoText returns null
      expect(comment.nodeValue).toBe('');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
