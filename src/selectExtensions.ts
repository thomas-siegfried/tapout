import { domDataGet, domDataSet, domDataNextKey } from './domData.js';

const optionValueDomDataKey = domDataNextKey();
const HAS_DOM_DATA = '__tapout_hasDomData';

function tagNameLower(element: Node): string {
  return (element as Element).tagName ? (element as Element).tagName.toLowerCase() : '';
}

export function readValue(element: Node): unknown {
  const el = element as HTMLOptionElement & HTMLSelectElement & HTMLInputElement & Record<string, unknown>;
  switch (tagNameLower(element)) {
    case 'option':
      if (el[HAS_DOM_DATA] === true) {
        return domDataGet(element, optionValueDomDataKey);
      }
      return el.value;
    case 'select':
      return el.selectedIndex >= 0
        ? readValue((el.options as HTMLOptionsCollection)[el.selectedIndex])
        : undefined;
    default:
      return el.value;
  }
}

export function writeValue(element: Node, value: unknown, allowUnset?: boolean): void {
  const el = element as HTMLOptionElement & HTMLSelectElement & HTMLInputElement & Record<string, unknown>;
  switch (tagNameLower(element)) {
    case 'option':
      if (typeof value === 'string') {
        domDataSet(element, optionValueDomDataKey, undefined);
        if (HAS_DOM_DATA in el) {
          delete el[HAS_DOM_DATA];
        }
        el.value = value;
      } else {
        domDataSet(element, optionValueDomDataKey, value);
        el[HAS_DOM_DATA] = true;
        el.value = typeof value === 'number' ? String(value) : '';
      }
      break;
    case 'select': {
      if (value === '' || value === null) value = undefined;
      let selection = -1;
      const options = el.options as HTMLOptionsCollection;
      for (let i = 0, n = options.length; i < n; ++i) {
        const optionValue = readValue(options[i]);
        if (optionValue == value || (optionValue === '' && value === undefined)) {
          selection = i;
          break;
        }
      }
      if (allowUnset || selection >= 0 || (value === undefined && el.size > 1)) {
        el.selectedIndex = selection;
      }
      break;
    }
    default:
      if (value === null || value === undefined) value = '';
      el.value = value as string;
      break;
  }
}

export function getOptionValueDomDataKey(): string {
  return optionValueDomDataKey;
}
