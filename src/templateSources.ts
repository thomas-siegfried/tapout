import { domDataGet, domDataSet, domDataNextKey } from './domData.js';
import { parseHtmlFragment } from './utilsDom.js';

const enum TemplateType {
  Script = 1,
  TextArea = 2,
  Template = 3,
  Element = 4,
}

const dataDomDataPrefix = domDataNextKey();
const templatesDomDataKey = domDataNextKey();

interface TemplateDomData {
  containerData?: DocumentFragment | HTMLElement;
  alwaysCheckText?: boolean;
  textData?: string;
}

function getTemplateDomData(element: Node): TemplateDomData {
  return (domDataGet(element, templatesDomDataKey) as TemplateDomData) || {};
}

function setTemplateDomData(element: Node, data: TemplateDomData): void {
  domDataSet(element, templatesDomDataKey, data);
}

export class DomElementSource {
  readonly domElement: Element;
  private templateType: TemplateType;

  constructor(element: Element) {
    this.domElement = element;
    const tagName = element.tagName?.toLowerCase();
    this.templateType =
      tagName === 'script' ? TemplateType.Script :
      tagName === 'textarea' ? TemplateType.TextArea :
      tagName === 'template' && (element as HTMLTemplateElement).content &&
        (element as HTMLTemplateElement).content.nodeType === 11 ? TemplateType.Template :
      TemplateType.Element;
  }

  text(): string;
  text(value: string): void;
  text(value?: string): string | void {
    const prop = this.templateType === TemplateType.Script ? 'text'
      : this.templateType === TemplateType.TextArea ? 'value'
      : 'innerHTML';

    if (arguments.length === 0) {
      return (this.domElement as unknown as Record<string, unknown>)[prop] as string;
    } else {
      (this.domElement as unknown as Record<string, unknown>)[prop] = value;
    }
  }

  data(key: string): unknown;
  data(key: string, value: unknown): void;
  data(key: string, value?: unknown): unknown | void {
    if (arguments.length === 1) {
      return domDataGet(this.domElement, dataDomDataPrefix + key);
    } else {
      domDataSet(this.domElement, dataDomDataPrefix + key, value);
    }
  }

  nodes(): DocumentFragment | HTMLElement | undefined;
  nodes(value: DocumentFragment | HTMLElement): void;
  nodes(value?: DocumentFragment | HTMLElement): DocumentFragment | HTMLElement | undefined | void {
    const element = this.domElement;
    if (arguments.length === 0) {
      const templateData = getTemplateDomData(element);
      let nodes = templateData.containerData || (
        this.templateType === TemplateType.Template ? (element as HTMLTemplateElement).content :
        this.templateType === TemplateType.Element ? element as HTMLElement :
        undefined
      );

      if (!nodes || templateData.alwaysCheckText) {
        const text = this.text();
        if (text && text !== templateData.textData) {
          const parsed = parseHtmlFragment(text, element.ownerDocument);
          const container = element.ownerDocument.createElement('div');
          for (const n of parsed) container.appendChild(n);
          setTemplateDomData(element, {
            containerData: container,
            textData: text,
            alwaysCheckText: true,
          });
          nodes = container;
        }
      }
      return nodes;
    } else {
      const templateData = getTemplateDomData(element);
      templateData.containerData = value;
      setTemplateDomData(element, templateData);
    }
  }
}

export class AnonymousSource extends DomElementSource {
  constructor(element: Element | Comment) {
    super(element as Element);
  }

  override text(): string;
  override text(value: string): void;
  override text(value?: string): string | void {
    if (arguments.length === 0) {
      const data = domDataGet(this.domElement, dataDomDataPrefix + 'anonymousTemplateText') as string | undefined;
      if (data === undefined) {
        const nodesContainer = this.nodes();
        if (nodesContainer) {
          return (nodesContainer as HTMLElement).innerHTML;
        }
      }
      return data as string;
    } else {
      domDataSet(this.domElement, dataDomDataPrefix + 'anonymousTemplateText', value);
    }
  }

  override nodes(): DocumentFragment | HTMLElement | undefined;
  override nodes(value: DocumentFragment | HTMLElement): void;
  override nodes(value?: DocumentFragment | HTMLElement): DocumentFragment | HTMLElement | undefined | void {
    if (arguments.length === 0) {
      const containerData = getTemplateDomData(this.domElement).containerData;
      return containerData;
    } else {
      setTemplateDomData(this.domElement, { containerData: value });
    }
  }
}
