import { DomElementSource, AnonymousSource } from './templateSources.js';
import { parseHtmlFragment } from './utilsDom.js';
import type { BindingContext } from './bindingContext.js';

export interface TemplateRenderOptions {
  templateEngine?: TemplateEngine;
  foreach?: unknown;
  as?: string;
  noChildContext?: boolean;
  includeDestroyed?: boolean;
  afterRender?: (nodes: Node[], data: unknown) => void;
  afterAdd?: (node: Node, index: number, item: unknown) => void;
  beforeRemove?: (node: Node, index: number, item: unknown) => void;
  beforeMove?: (node: Node, index: number, item: unknown) => void;
  afterMove?: (node: Node, index: number, item: unknown) => void;
  if?: unknown;
  ifnot?: unknown;
  data?: unknown;
  exportDependencies?: boolean;
  dontLimitMoves?: boolean;
}

export type TemplateSource = DomElementSource | AnonymousSource;

export abstract class TemplateEngine {
  allowTemplateRewriting = false;

  abstract renderTemplateSource(
    templateSource: TemplateSource,
    bindingContext: BindingContext,
    options: TemplateRenderOptions,
    templateDocument?: Document,
  ): Node[];

  createJavaScriptEvaluatorBlock(_script: string): string {
    throw new Error('Override createJavaScriptEvaluatorBlock');
  }

  makeTemplateSource(template: string | Node, templateDocument?: Document): TemplateSource {
    if (typeof template === 'string') {
      const doc = templateDocument || document;
      const elem = doc.getElementById(template);
      if (!elem) throw new Error('Cannot find template with ID ' + template);
      return new DomElementSource(elem);
    } else if (template.nodeType === 1 || template.nodeType === 8) {
      return new AnonymousSource(template as Element | Comment);
    } else {
      throw new Error('Unknown template type: ' + template);
    }
  }

  renderTemplate(
    template: string | Node,
    bindingContext: BindingContext,
    options: TemplateRenderOptions,
    templateDocument?: Document,
  ): Node[] {
    const source = this.makeTemplateSource(template, templateDocument);
    return this.renderTemplateSource(source, bindingContext, options, templateDocument);
  }

  isTemplateRewritten(template: string | Node, templateDocument?: Document): boolean {
    if (this.allowTemplateRewriting === false) return true;
    return !!this.makeTemplateSource(template, templateDocument).data('isRewritten');
  }

  rewriteTemplate(
    template: string | Node,
    rewriterCallback: (text: string) => string,
    templateDocument?: Document,
  ): void {
    const templateSource = this.makeTemplateSource(template, templateDocument);
    const rewritten = rewriterCallback(templateSource.text());
    templateSource.text(rewritten);
    templateSource.data('isRewritten', true);
  }
}

export class NativeTemplateEngine extends TemplateEngine {
  override allowTemplateRewriting = false;

  renderTemplateSource(
    templateSource: TemplateSource,
    _bindingContext: BindingContext,
    _options: TemplateRenderOptions,
    templateDocument?: Document,
  ): Node[] {
    const templateNodes = templateSource.nodes();
    if (templateNodes) {
      return Array.from(templateNodes.cloneNode(true).childNodes);
    } else {
      const templateText = templateSource.text();
      return parseHtmlFragment(templateText, templateDocument);
    }
  }
}

export const nativeTemplateEngine = new NativeTemplateEngine();

let _templateEngine: TemplateEngine = nativeTemplateEngine;

export function setTemplateEngine(engine: TemplateEngine): void {
  _templateEngine = engine;
}

export function getTemplateEngine(): TemplateEngine {
  return _templateEngine;
}
