import { Window } from 'happy-dom';
import {
  parseInterpolationMarkup,
  wrapExpression,
  interpolationMarkupPreprocessor,
  enableInterpolationMarkup,
  bindingProviderInstance,
  Observable,
  applyBindings,
} from '#src/index.js';

const window = new Window();
const document = window.document;

describe('Interpolation Markup', () => {

  describe('parseInterpolationMarkup', () => {
    function parse(text: string): { texts: string[]; expressions: string[] } {
      const texts: string[] = [];
      const expressions: string[] = [];
      parseInterpolationMarkup(
        text,
        (t) => texts.push(t),
        (e) => expressions.push(e),
      );
      return { texts, expressions };
    }

    it('does nothing when there are no {{ }} markers', () => {
      const result = parse('plain text');
      expect(result.texts).toEqual([]);
      expect(result.expressions).toEqual([]);
    });

    it('parses a single expression', () => {
      const result = parse('{{ name }}');
      expect(result.texts).toEqual(['', '']);
      expect(result.expressions).toEqual([' name ']);
    });

    it('parses text before and after an expression', () => {
      const result = parse('Hello {{ name }}!');
      expect(result.texts).toEqual(['Hello ', '!']);
      expect(result.expressions).toEqual([' name ']);
    });

    it('parses multiple expressions', () => {
      const result = parse('{{ first }} and {{ second }}');
      expect(result.texts).toEqual(['', ' and ', '']);
      expect(result.expressions).toEqual([' first ', ' second ']);
    });

    it('parses expression with no surrounding text', () => {
      const result = parse('{{x}}');
      expect(result.texts).toEqual(['', '']);
      expect(result.expressions).toEqual(['x']);
    });

    it('handles triple-brace html syntax', () => {
      const result = parse('{{{ rawHtml }}}');
      // Outer {{ and }} are consumed; inner content includes the extra braces
      expect(result.expressions).toEqual(['{ rawHtml }']);
    });

    it('handles adjacent expressions', () => {
      const result = parse('{{a}}{{b}}');
      expect(result.expressions).toEqual(['a', 'b']);
    });

    it('handles virtual element opening syntax', () => {
      const result = parse('{{# if condition }}');
      expect(result.expressions).toEqual(['# if condition ']);
    });

    it('handles virtual element closing syntax', () => {
      const result = parse('{{/ if }}');
      expect(result.expressions).toEqual(['/ if ']);
    });
  });

  describe('wrapExpression', () => {
    function commentText(node: Node): string {
      return node.nodeValue || '';
    }

    it('wraps plain expression as text binding', () => {
      const nodes = wrapExpression('name', undefined);
      expect(nodes.length).toBe(2);
      expect(nodes[0].nodeType).toBe(8); // Comment
      expect(commentText(nodes[0])).toContain('tap text:name');
      expect(nodes[1].nodeType).toBe(8);
      expect(commentText(nodes[1])).toContain('/tap');
    });

    it('wraps expression with leading/trailing spaces as text binding', () => {
      const nodes = wrapExpression('  name  ', undefined);
      expect(nodes.length).toBe(2);
      expect(commentText(nodes[0])).toContain('tap text:name');
    });

    it('wraps {expr} as html binding', () => {
      const nodes = wrapExpression('{ rawHtml }', undefined);
      expect(nodes.length).toBe(2);
      expect(commentText(nodes[0])).toContain('tap html:rawHtml');
      expect(commentText(nodes[1])).toContain('/tap');
    });

    it('creates opening comment for # binding (no close)', () => {
      const nodes = wrapExpression('# if condition', undefined);
      expect(nodes.length).toBe(1);
      expect(commentText(nodes[0])).toContain('tap if:condition');
    });

    it('creates self-closing comments for # binding ending with /', () => {
      const nodes = wrapExpression('# text value /', undefined);
      expect(nodes.length).toBe(2);
      expect(commentText(nodes[0])).toContain('tap text:value');
      expect(commentText(nodes[1])).toContain('/tap');
    });

    it('creates only a closing comment for / expression', () => {
      const nodes = wrapExpression('/ if', undefined);
      expect(nodes.length).toBe(1);
      expect(commentText(nodes[0])).toContain('/tap');
    });

    it('handles # binding with colon syntax (passthrough)', () => {
      const nodes = wrapExpression('# foreach: items', undefined);
      expect(nodes.length).toBe(1);
      expect(commentText(nodes[0])).toContain('tap foreach: items');
    });

    it('returns empty array for empty expression', () => {
      const nodes = wrapExpression('', undefined);
      // empty string after trim: firstChar is undefined, falls to text binding
      // "text:" with empty — still creates comments
      expect(nodes.length).toBe(2);
    });

    it('uses the provided node ownerDocument', () => {
      const textNode = document.createTextNode('test') as unknown as Node;
      const nodes = wrapExpression('x', textNode);
      expect(nodes.length).toBe(2);
      expect(nodes[0].nodeType).toBe(8);
    });
  });

  describe('interpolationMarkupPreprocessor', () => {
    it('replaces a text node containing {{ }} with comment-based binding nodes', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('Hello {{ name }}!');
      container.appendChild(textNode);

      const result = interpolationMarkupPreprocessor(textNode as unknown as Node);

      expect(result).toBeDefined();
      expect(result!.length).toBeGreaterThan(0);
      // Container should now have replacement nodes
      expect(container.childNodes.length).toBeGreaterThan(1);
      // Original text node should be gone
      expect(container.contains(textNode)).toBe(false);
    });

    it('returns undefined for text nodes without {{ }}', () => {
      const textNode = document.createTextNode('plain text');
      document.body.appendChild(textNode);
      const result = interpolationMarkupPreprocessor(textNode as unknown as Node);
      expect(result).toBeUndefined();
      textNode.remove();
    });

    it('returns undefined for non-text nodes', () => {
      const el = document.createElement('div');
      const result = interpolationMarkupPreprocessor(el as unknown as Node);
      expect(result).toBeUndefined();
    });

    it('skips text nodes inside TEXTAREA', () => {
      const textarea = document.createElement('textarea');
      const textNode = document.createTextNode('{{ value }}');
      textarea.appendChild(textNode);
      document.body.appendChild(textarea);

      const result = interpolationMarkupPreprocessor(textNode as unknown as Node);
      expect(result).toBeUndefined();
      textarea.remove();
    });

    it('produces correct node sequence for text expression', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('{{ x }}');
      container.appendChild(textNode);

      interpolationMarkupPreprocessor(textNode as unknown as Node);

      const children = Array.from(container.childNodes);
      // Should be: comment (tap text:x), comment (/tap)
      // Possibly with empty text nodes from leading/trailing empty strings
      const comments = children.filter(n => n.nodeType === 8);
      expect(comments.length).toBe(2);
      expect((comments[0] as Comment).data).toContain('tap text:x');
      expect((comments[1] as Comment).data).toContain('/tap');
    });

    it('produces correct node sequence for html expression', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('{{{ raw }}}');
      container.appendChild(textNode);

      interpolationMarkupPreprocessor(textNode as unknown as Node);

      const comments = Array.from(container.childNodes).filter(n => n.nodeType === 8);
      expect(comments.length).toBe(2);
      expect((comments[0] as Comment).data).toContain('tap html:raw');
      expect((comments[1] as Comment).data).toContain('/tap');
    });

    it('produces correct node sequence for mixed text and expressions', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('Hello {{ name }}, welcome!');
      container.appendChild(textNode);

      interpolationMarkupPreprocessor(textNode as unknown as Node);

      const children = Array.from(container.childNodes);
      const textNodes = children.filter(n => n.nodeType === 3);
      const commentNodes = children.filter(n => n.nodeType === 8);

      expect(textNodes.some(n => n.textContent === 'Hello ')).toBe(true);
      expect(textNodes.some(n => n.textContent === ', welcome!')).toBe(true);
      expect(commentNodes.length).toBe(2);
    });

    it('handles virtual element opening/closing syntax', () => {
      const container = document.createElement('div');
      const openNode = document.createTextNode('{{# if show }}');
      const contentNode = document.createTextNode('content');
      const closeNode = document.createTextNode('{{/ if }}');
      container.appendChild(openNode);
      container.appendChild(contentNode);
      container.appendChild(closeNode);

      interpolationMarkupPreprocessor(openNode as unknown as Node);
      interpolationMarkupPreprocessor(closeNode as unknown as Node);

      const comments = Array.from(container.childNodes).filter(n => n.nodeType === 8);
      expect(comments.some(c => (c as Comment).data.includes('tap if:show'))).toBe(true);
      expect(comments.some(c => (c as Comment).data.includes('/tap'))).toBe(true);
    });
  });

  describe('enableInterpolationMarkup', () => {
    let originalPreprocessNode: typeof bindingProviderInstance.preprocessNode;

    beforeEach(() => {
      originalPreprocessNode = bindingProviderInstance.preprocessNode;
    });

    afterEach(() => {
      bindingProviderInstance.preprocessNode = originalPreprocessNode;
    });

    it('registers the interpolation preprocessor on the binding provider', () => {
      bindingProviderInstance.preprocessNode = undefined;
      enableInterpolationMarkup();
      expect(bindingProviderInstance.preprocessNode).toBeDefined();
    });
  });

  describe('html binding with virtual elements', () => {
    it('renders HTML content inside a virtual element', () => {
      const container = document.createElement('div');
      container.innerHTML = '<!-- tap html: content --><!-- /tap -->';
      const content = new Observable('<b>bold</b>');
      document.body.appendChild(container);

      applyBindings({ content }, container as unknown as Node);

      expect(container.innerHTML).toContain('<b>bold</b>');
      content.set('<em>italic</em>');
      expect(container.innerHTML).toContain('<em>italic</em>');

      container.remove();
    });

    it('clears virtual element content when set to null', () => {
      const container = document.createElement('div');
      container.innerHTML = '<!-- tap html: content --><!-- /tap -->';
      const content = new Observable<string | null>('<b>bold</b>');
      document.body.appendChild(container);

      applyBindings({ content }, container as unknown as Node);
      expect(container.innerHTML).toContain('<b>bold</b>');

      content.set(null);
      // The comment markers should remain but content between them should be empty
      const comments = Array.from(container.childNodes).filter(n => n.nodeType === 8);
      expect(comments.length).toBe(2);
      const elements = Array.from(container.childNodes).filter(n => n.nodeType === 1);
      expect(elements.length).toBe(0);

      container.remove();
    });
  });

  describe('end-to-end interpolation with applyBindings', () => {
    let originalPreprocessNode: typeof bindingProviderInstance.preprocessNode;

    beforeEach(() => {
      originalPreprocessNode = bindingProviderInstance.preprocessNode;
      bindingProviderInstance.preprocessNode = undefined;
      enableInterpolationMarkup();
    });

    afterEach(() => {
      bindingProviderInstance.preprocessNode = originalPreprocessNode;
    });

    it('renders {{ expression }} as text content', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.appendChild(document.createTextNode('{{ name }}'));
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ name: 'Alice' }, container as unknown as Node);

      expect(inner.textContent).toBe('Alice');
      container.remove();
    });

    it('renders {{ observable }} reactively', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.appendChild(document.createTextNode('{{ name }}'));
      container.appendChild(inner);
      document.body.appendChild(container);

      const name = new Observable('Alice');
      applyBindings({ name }, container as unknown as Node);

      expect(inner.textContent).toBe('Alice');
      name.set('Bob');
      expect(inner.textContent).toBe('Bob');
      container.remove();
    });

    it('renders mixed text and expressions', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.appendChild(document.createTextNode('Hello {{ name }}!'));
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ name: 'Alice' }, container as unknown as Node);

      expect(inner.textContent).toBe('Hello Alice!');
      container.remove();
    });

    it('renders {{{ }}} as html content', () => {
      const container = document.createElement('div');
      const inner = document.createElement('span');
      inner.appendChild(document.createTextNode('{{{ content }}}'));
      container.appendChild(inner);
      document.body.appendChild(container);

      applyBindings({ content: '<b>bold</b>' }, container as unknown as Node);

      expect(inner.innerHTML).toContain('<b>bold</b>');
      container.remove();
    });

    it('renders {{# if }} virtual element blocks', () => {
      const container = document.createElement('div');
      container.appendChild(document.createTextNode('{{# if show }}'));
      const span = document.createElement('span');
      span.textContent = 'visible';
      container.appendChild(span);
      container.appendChild(document.createTextNode('{{/ if }}'));
      document.body.appendChild(container);

      const show = new Observable(true);
      applyBindings({ show }, container as unknown as Node);

      expect(container.textContent).toContain('visible');

      show.set(false);
      expect(container.textContent).not.toContain('visible');

      show.set(true);
      expect(container.textContent).toContain('visible');

      container.remove();
    });
  });
});
