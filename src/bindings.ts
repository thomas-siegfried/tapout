import { unwrapObservable, parseHtmlFragment } from './utils.js';
import { bindingHandlers } from './bindingProvider.js';
import type { BindingHandler, AllBindingsAccessor } from './bindingProvider.js';
import { allowedVirtualElementBindings, virtualFirstChild, virtualNextSibling, virtualSetChildren, virtualEmptyNode } from './virtualElements.js';
import { addDisposeCallback, removeNode } from './domNodeDisposal.js';
import { twoWayBindings, writeValueToProperty } from './expressionRewriting.js';
import { Computed, PureComputed } from './computed.js';
import { Observable } from './observable.js';
import { isObservableArray } from './observableArray.js';
import { ignore, isInitial, getDependenciesCount } from './dependencyDetection.js';
import { bindingEvent } from './bindingEvent.js';
import * as selectExtensions from './selectExtensions.js';

// ---- Shared DOM Utilities ----

function triggerEvent(element: Node, eventType: string): void {
  const EventCtor = ((element.ownerDocument?.defaultView) as unknown as typeof globalThis)?.Event ?? Event;
  element.dispatchEvent(new EventCtor(eventType, { bubbles: true, cancelable: true }));
}


function setTextContent(element: Node, textContent: unknown): void {
  let value = unwrapObservable(textContent);
  if (value === null || value === undefined) value = '';

  const innerTextNode = virtualFirstChild(element);
  if (!innerTextNode || innerTextNode.nodeType !== 3 || virtualNextSibling(innerTextNode)) {
    const doc = (element as Element).ownerDocument ?? (element as Document);
    virtualSetChildren(element, [doc.createTextNode(String(value))]);
  } else {
    (innerTextNode as Text).data = String(value);
  }
}

function emptyDomNode(node: Node): void {
  while (node.firstChild) {
    removeNode(node.firstChild);
  }
}

function setHtml(node: Node, html: unknown): void {
  html = unwrapObservable(html);

  if (node.nodeType === 8) {
    if (html != null) {
      const parsedNodes = parseHtmlFragment('' + html, node.ownerDocument ?? undefined);
      virtualSetChildren(node, parsedNodes);
    } else {
      virtualEmptyNode(node);
    }
  } else {
    emptyDomNode(node);
    if (html === null || html === undefined) return;
    const el = node as Element;
    el.innerHTML = typeof html === 'string' ? html : String(html);
  }
}

const CSS_CLASS_REGEX = /\S+/g;
const CLASSES_WRITTEN_KEY = '__tapout__cssValue';

function toggleDomNodeCssClass(node: Element, classNames: string | null | undefined, shouldHaveClass: boolean): void {
  if (!classNames) return;

  const matches = classNames.match(CSS_CLASS_REGEX);
  if (!matches) return;

  if (typeof node.classList === 'object') {
    const fn = shouldHaveClass ? 'add' : 'remove';
    for (const cls of matches) {
      node.classList[fn](cls);
    }
  } else if (typeof (node.className as unknown as { baseVal?: string })?.baseVal === 'string') {
    // SVG element
    toggleClassPropertyString(node.className as unknown as { baseVal: string }, 'baseVal', matches, shouldHaveClass);
  } else {
    toggleClassPropertyString(node as unknown as Record<string, string>, 'className', matches, shouldHaveClass);
  }
}

function toggleClassPropertyString(
  obj: Record<string, string>,
  prop: string,
  classNames: string[],
  shouldHaveClass: boolean,
): void {
  const current: string[] = (obj[prop] || '').match(CSS_CLASS_REGEX)?.slice() ?? [];
  for (const cls of classNames) {
    const idx = current.indexOf(cls);
    if (shouldHaveClass && idx === -1) {
      current.push(cls);
    } else if (!shouldHaveClass && idx !== -1) {
      current.splice(idx, 1);
    }
  }
  obj[prop] = current.join(' ');
}

function setElementName(element: Element, name: string): void {
  (element as HTMLInputElement).name = name;
}

// ---- Task 17: One-way display bindings ----

const textHandler: BindingHandler = {
  init() {
    return { controlsDescendantBindings: true };
  },
  update(node, valueAccessor) {
    setTextContent(node, valueAccessor());
  },
};

const htmlHandler: BindingHandler = {
  init() {
    return { controlsDescendantBindings: true };
  },
  update(node, valueAccessor) {
    setHtml(node, valueAccessor());
  },
};

const visibleHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as HTMLElement;
    const value = unwrapObservable(valueAccessor());
    const isCurrentlyVisible = el.style.display !== 'none';
    if (value && !isCurrentlyVisible) {
      el.style.display = '';
    } else if (!value && isCurrentlyVisible) {
      el.style.display = 'none';
    }
  },
};

const hiddenHandler: BindingHandler = {
  update(node, valueAccessor) {
    visibleHandler.update!(node, () => !unwrapObservable(valueAccessor()), {} as never, undefined, {} as never);
  },
};

// ---- Task 18: Attribute bindings ----

const attrHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as Element;
    const value = unwrapObservable(valueAccessor()) as Record<string, unknown> | null;
    if (!value) return;

    for (const attrName of Object.keys(value)) {
      let attrValue = unwrapObservable(value[attrName]);

      const prefixLen = attrName.indexOf(':');
      const namespace = 'lookupNamespaceURI' in el && prefixLen > 0
        ? (el as Element).lookupNamespaceURI(attrName.substring(0, prefixLen))
        : null;

      const toRemove = attrValue === false || attrValue === null || attrValue === undefined;

      if (toRemove) {
        namespace
          ? el.removeAttributeNS(namespace, attrName)
          : el.removeAttribute(attrName);
      } else {
        const strValue = String(attrValue);
        namespace
          ? el.setAttributeNS(namespace, attrName, strValue)
          : el.setAttribute(attrName, strValue);
      }

      if (attrName === 'name') {
        setElementName(el, toRemove ? '' : String(attrValue));
      }
    }
  },
};

const classHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as Element;
    const value = String(unwrapObservable(valueAccessor()) ?? '').trim();
    const previousValue = (el as unknown as Record<string, string>)[CLASSES_WRITTEN_KEY];
    toggleDomNodeCssClass(el, previousValue, false);
    (el as unknown as Record<string, string>)[CLASSES_WRITTEN_KEY] = value;
    toggleDomNodeCssClass(el, value, true);
  },
};

const cssHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as Element;
    const value = unwrapObservable(valueAccessor());
    if (value !== null && typeof value === 'object') {
      for (const className of Object.keys(value as Record<string, unknown>)) {
        const shouldHaveClass = !!unwrapObservable((value as Record<string, unknown>)[className]);
        toggleDomNodeCssClass(el, className, shouldHaveClass);
      }
    } else {
      classHandler.update!(node, valueAccessor, {} as never, undefined, {} as never);
    }
  },
};

const styleHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as HTMLElement;
    const value = unwrapObservable(valueAccessor() || {}) as Record<string, unknown>;

    for (const styleName of Object.keys(value)) {
      let styleValue = unwrapObservable(value[styleName]);

      if (styleValue === null || styleValue === undefined || styleValue === false) {
        styleValue = '';
      }

      if (/^--/.test(styleName)) {
        el.style.setProperty(styleName, String(styleValue));
      } else {
        const camelCased = styleName.replace(/-(\w)/g, (_all, letter: string) => letter.toUpperCase());

        const previousStyle = (el.style as unknown as Record<string, string>)[camelCased];
        (el.style as unknown as Record<string, string>)[camelCased] = String(styleValue);

        if (
          String(styleValue) !== previousStyle &&
          (el.style as unknown as Record<string, string>)[camelCased] === previousStyle &&
          !isNaN(styleValue as number)
        ) {
          (el.style as unknown as Record<string, string>)[camelCased] = styleValue + 'px';
        }
      }
    }
  },
};

// ---- Task 19: Form state bindings ----

const enableHandler: BindingHandler = {
  update(node, valueAccessor) {
    const el = node as HTMLElement;
    const value = unwrapObservable(valueAccessor());
    if (value && (el as HTMLInputElement).disabled) {
      el.removeAttribute('disabled');
    } else if (!value && !(el as HTMLInputElement).disabled) {
      (el as HTMLInputElement).disabled = true;
    }
  },
};

const disableHandler: BindingHandler = {
  update(node, valueAccessor) {
    enableHandler.update!(node, () => !unwrapObservable(valueAccessor()), {} as never, undefined, {} as never);
  },
};

let uniqueNameIndex = 0;

const uniqueNameHandler: BindingHandler = {
  init(node, valueAccessor) {
    if (valueAccessor()) {
      const name = 'tap_unique_' + (++uniqueNameIndex);
      setElementName(node as Element, name);
    }
  },
};

// ---- Task 20: Event bindings ----

const eventHandler: BindingHandler = {
  init(node, valueAccessor, allBindings, viewModel, bindingContext) {
    const el = node as HTMLElement;
    const eventsToHandle = (valueAccessor() || {}) as Record<string, unknown>;
    for (const eventName of Object.keys(eventsToHandle)) {
      el.addEventListener(eventName, function (event: Event) {
        const handlerFunction = (valueAccessor() as Record<string, Function>)[eventName];
        if (!handlerFunction) return;

        let handlerReturnValue: unknown;
        try {
          const data = bindingContext.$data;
          handlerReturnValue = handlerFunction.call(data, data, event);
        } finally {
          if (handlerReturnValue !== true) {
            event.preventDefault();
          }
        }

        const bubble = allBindings.get(eventName + 'Bubble') !== false;
        if (!bubble) {
          event.stopPropagation();
        }
      });
    }
  },
};

function makeEventHandlerShortcut(eventName: string): BindingHandler {
  return {
    init(node, valueAccessor, allBindings, viewModel, bindingContext) {
      const newValueAccessor = () => {
        const result: Record<string, unknown> = {};
        result[eventName] = valueAccessor();
        return result;
      };
      return eventHandler.init!(node, newValueAccessor, allBindings, viewModel, bindingContext);
    },
  };
}

const clickHandler = makeEventHandlerShortcut('click');

const submitHandler: BindingHandler = {
  init(node, valueAccessor, _allBindings, _viewModel, bindingContext) {
    if (typeof valueAccessor() !== 'function') {
      throw new Error('The value for a submit binding must be a function');
    }
    (node as HTMLElement).addEventListener('submit', function (event: Event) {
      let handlerReturnValue: unknown;
      const value = valueAccessor() as Function;
      try {
        handlerReturnValue = value.call(bindingContext.$data, node);
      } finally {
        if (handlerReturnValue !== true) {
          event.preventDefault();
        }
      }
    });
  },
};

// ---- Task 21: value binding ----

const valueHandler: BindingHandler = {
  init(node, valueAccessor, allBindings) {
    const el = node as HTMLElement & { value: string; type?: string; selectedIndex?: number; options?: HTMLOptionsCollection; multiple?: boolean; size?: number };
    const tagName = (el.tagName || '').toLowerCase();
    const isInputElement = tagName === 'input';

    if (isInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      checkedValueHandler.update!(node, valueAccessor, allBindings, undefined, {} as never);
      return;
    }

    let eventsToCatch: string[] = [];
    const requestedEventsToCatch = allBindings.get('valueUpdate');
    let elementValueBeforeEvent: unknown = null;

    if (requestedEventsToCatch) {
      if (typeof requestedEventsToCatch === 'string') {
        eventsToCatch = [requestedEventsToCatch];
      } else {
        eventsToCatch = [...new Set(requestedEventsToCatch as string[])];
      }
      const changeIdx = eventsToCatch.indexOf('change');
      if (changeIdx >= 0) eventsToCatch.splice(changeIdx, 1);
    }

    const valueUpdateHandler = () => {
      elementValueBeforeEvent = null;
      const modelValue = valueAccessor();
      const elementValue = selectExtensions.readValue(el);
      writeValueToProperty(modelValue, allBindings, 'value', elementValue);
    };

    for (const eventName of eventsToCatch) {
      let handler = valueUpdateHandler;
      if (eventName.startsWith('after')) {
        const actualHandler = () => {
          elementValueBeforeEvent = selectExtensions.readValue(el);
          setTimeout(valueUpdateHandler, 0);
        };
        el.addEventListener(eventName.substring(5), actualHandler);
        continue;
      }
      el.addEventListener(eventName, handler);
    }

    let updateFromModelComputed: Computed<void> | null = null;

    const updateFromModel = () => {
      let newValue = unwrapObservable(valueAccessor());
      const elementValue = selectExtensions.readValue(el);

      if (elementValueBeforeEvent !== null && newValue === elementValueBeforeEvent) {
        setTimeout(updateFromModel, 0);
        return;
      }

      const valueHasChanged = newValue !== elementValue;

      if (valueHasChanged || elementValue === undefined) {
        if (tagName === 'select') {
          const allowUnset = allBindings.get('valueAllowUnset');
          selectExtensions.writeValue(el, newValue, !!allowUnset);
          if (!allowUnset && newValue !== selectExtensions.readValue(el)) {
            ignore(valueUpdateHandler);
          }
        } else {
          selectExtensions.writeValue(el, newValue);
        }
      }
    };

    if (tagName === 'select') {
      el.addEventListener('change', () => {
        if (updateFromModelComputed) valueUpdateHandler();
      });
      bindingEvent.subscribe(node, bindingEvent.childrenComplete, () => {
        if (!updateFromModelComputed) {
          updateFromModelComputed = new Computed(updateFromModel);
          addDisposeCallback(node, () => updateFromModelComputed!.dispose());
        } else if (allBindings.get('valueAllowUnset')) {
          updateFromModel();
        } else {
          valueUpdateHandler();
        }
      }, null, { notifyImmediately: true });
    } else {
      el.addEventListener('change', valueUpdateHandler);
      const comp = new Computed(updateFromModel);
      addDisposeCallback(node, () => comp.dispose());
    }
  },
  update() {},
};

// ---- Task 22: textInput binding ----

const textInputHandler: BindingHandler = {
  init(node, valueAccessor, allBindings) {
    const el = node as HTMLInputElement | HTMLTextAreaElement;
    let previousElementValue = el.value;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let elementValueBeforeEvent: string | undefined;
    let ourUpdate = false;

    const updateModel = (_event?: Event) => {
      clearTimeout(timeoutHandle);
      elementValueBeforeEvent = timeoutHandle = undefined;

      const elementValue = el.value;
      if (previousElementValue !== elementValue) {
        previousElementValue = elementValue;
        writeValueToProperty(valueAccessor(), allBindings, 'textInput', elementValue);
      }
    };

    const deferUpdateModel = (_event?: Event) => {
      if (!timeoutHandle) {
        elementValueBeforeEvent = el.value;
        timeoutHandle = setTimeout(updateModel, 4);
      }
    };

    const updateView = () => {
      let modelValue = unwrapObservable(valueAccessor()) as string;

      if (modelValue === null || modelValue === undefined) {
        modelValue = '';
      }

      if (elementValueBeforeEvent !== undefined && modelValue === elementValueBeforeEvent) {
        setTimeout(updateView, 4);
        return;
      }

      if (el.value !== modelValue) {
        ourUpdate = true;
        el.value = modelValue;
        ourUpdate = false;
        previousElementValue = el.value;
      }
    };

    el.addEventListener('input', updateModel);
    el.addEventListener('change', updateModel);
    el.addEventListener('blur', updateModel);

    const viewComputed = new Computed(updateView);
    addDisposeCallback(node, () => viewComputed.dispose());
  },
};

const textinputAliasHandler: BindingHandler = {
  preprocess(value, _name, addBinding) {
    addBinding('textInput', value!);
  },
};

// ---- Task 23: checked / checkedValue bindings ----

function addOrRemoveItem<T>(array: T[], value: T, included: boolean): void {
  const existingIndex = array.indexOf(value);
  if (included && existingIndex < 0) {
    array.push(value);
  } else if (!included && existingIndex >= 0) {
    array.splice(existingIndex, 1);
  }
}

const checkedHandler: BindingHandler = {
  after: ['value', 'attr'],
  init(node, valueAccessor, allBindings) {
    const el = node as HTMLInputElement;
    const isCheckbox = el.type === 'checkbox';
    const isRadio = el.type === 'radio';

    if (!isCheckbox && !isRadio) return;

    const checkedValue = new PureComputed(() => {
      if (allBindings.has('checkedValue')) {
        return unwrapObservable(allBindings.get('checkedValue'));
      } else if (useElementValue) {
        if (allBindings.has('value')) {
          return unwrapObservable(allBindings.get('value'));
        } else {
          return el.value;
        }
      }
    });

    const rawValue = valueAccessor();
    const valueIsArray = isCheckbox && (unwrapObservable(rawValue) instanceof Array);
    const rawValueIsNonArrayObservable = !(valueIsArray && (rawValue as unknown[]).push && (rawValue as unknown[]).splice);
    const useElementValue = isRadio || valueIsArray;
    let oldElemValue: unknown = valueIsArray ? checkedValue.peek() : undefined;

    if (isRadio && !el.name) {
      uniqueNameHandler.init!(node, () => true, {} as AllBindingsAccessor, undefined, {} as never);
    }

    function updateModel() {
      const isChecked = el.checked;
      let elemValue = checkedValue.peek();

      if (isInitial()) return;

      if (!isChecked && (isRadio || getDependenciesCount())) return;

      const modelValue = ignore(valueAccessor);
      if (valueIsArray) {
        const writableValue = rawValueIsNonArrayObservable
          ? (modelValue as Observable<unknown[]>).peek()
          : modelValue as unknown[];
        const saveOldValue = oldElemValue;
        oldElemValue = elemValue;

        if (saveOldValue !== elemValue) {
          if (isChecked) {
            addOrRemoveItem(writableValue as unknown[], elemValue, true);
            addOrRemoveItem(writableValue as unknown[], saveOldValue, false);
          }
        } else {
          addOrRemoveItem(writableValue as unknown[], elemValue, isChecked);
        }

        if (rawValueIsNonArrayObservable && isWritableObs(modelValue)) {
          (modelValue as Observable<unknown>).set(writableValue);
        }
      } else {
        if (isCheckbox) {
          if (elemValue === undefined) {
            elemValue = isChecked;
          } else if (!isChecked) {
            elemValue = undefined;
          }
        }
        writeValueToProperty(modelValue, allBindings, 'checked', elemValue, true);
      }
    }

    function updateView() {
      const modelValue = unwrapObservable(valueAccessor());
      const elemValue = checkedValue.peek();

      if (valueIsArray) {
        el.checked = modelValue != null &&
          (modelValue as unknown[]).indexOf(elemValue) >= 0;
        oldElemValue = elemValue;
      } else if (isCheckbox && elemValue === undefined) {
        el.checked = !!modelValue;
      } else {
        el.checked = (checkedValue.peek() === modelValue);
      }
    }

    const updateModelComputed = new Computed(updateModel);
    addDisposeCallback(node, () => updateModelComputed.dispose());
    el.addEventListener('click', updateModel);

    const updateViewComputed = new Computed(updateView);
    addDisposeCallback(node, () => updateViewComputed.dispose());
  },
};

const checkedValueHandler: BindingHandler = {
  update(node, valueAccessor) {
    (node as HTMLInputElement).value = unwrapObservable(valueAccessor()) as string;
  },
};

// ---- Task 24: hasfocus / hasFocus bindings ----

const HASFOCUS_UPDATING = '__tapout_hasfocusUpdating';
const HASFOCUS_LAST_VALUE = '__tapout_hasfocusLastValue';

const hasfocusHandler: BindingHandler = {
  init(node, valueAccessor, allBindings) {
    const el = node as HTMLElement & Record<string, unknown>;

    const handleElementFocusChange = (isFocused: boolean) => {
      el[HASFOCUS_UPDATING] = true;
      const ownerDoc = el.ownerDocument;
      if (ownerDoc && 'activeElement' in ownerDoc) {
        try {
          isFocused = (ownerDoc.activeElement === el);
        } catch {
          isFocused = false;
        }
      }
      const modelValue = valueAccessor();
      writeValueToProperty(modelValue, allBindings, 'hasfocus', isFocused, true);
      el[HASFOCUS_LAST_VALUE] = isFocused;
      el[HASFOCUS_UPDATING] = false;
    };

    const handleFocusIn = () => handleElementFocusChange(true);
    const handleFocusOut = () => handleElementFocusChange(false);

    el.addEventListener('focus', handleFocusIn);
    el.addEventListener('focusin', handleFocusIn);
    el.addEventListener('blur', handleFocusOut);
    el.addEventListener('focusout', handleFocusOut);

    el[HASFOCUS_LAST_VALUE] = false;
  },
  update(node, valueAccessor) {
    const el = node as HTMLElement & Record<string, unknown>;
    const value = !!unwrapObservable(valueAccessor());

    if (!el[HASFOCUS_UPDATING] && el[HASFOCUS_LAST_VALUE] !== value) {
      if (value) {
        el.focus();
      } else {
        el.blur();
      }
    }
  },
};

// ---- Task 25: selectedOptions binding ----

const selectedOptionsHandler: BindingHandler = {
  init(node, valueAccessor, allBindings) {
    const el = node as HTMLSelectElement;

    if ((el.tagName || '').toLowerCase() !== 'select') {
      throw new Error('selectedOptions binding applies only to SELECT elements');
    }

    function updateFromView() {
      const value = valueAccessor();
      const valueToWrite: unknown[] = [];
      const options = el.getElementsByTagName('option');
      for (let i = 0; i < options.length; i++) {
        if ((options[i] as HTMLOptionElement).selected) {
          valueToWrite.push(selectExtensions.readValue(options[i]));
        }
      }
      writeValueToProperty(value, allBindings, 'selectedOptions', valueToWrite);
    }

    function updateFromModel() {
      const newValue = unwrapObservable(valueAccessor()) as unknown[] | null;
      const previousScrollTop = el.scrollTop;

      if (newValue && typeof (newValue as unknown[]).length === 'number') {
        const options = el.getElementsByTagName('option');
        for (let i = 0; i < options.length; i++) {
          const optEl = options[i] as HTMLOptionElement;
          const isSelected = (newValue as unknown[]).indexOf(selectExtensions.readValue(optEl)) >= 0;
          if (optEl.selected !== isSelected) {
            optEl.selected = isSelected;
          }
        }
      }

      el.scrollTop = previousScrollTop;
    }

    let updateFromModelComputed: Computed<void> | null = null;
    bindingEvent.subscribe(node, bindingEvent.childrenComplete, () => {
      if (!updateFromModelComputed) {
        el.addEventListener('change', updateFromView);
        updateFromModelComputed = new Computed(updateFromModel);
        addDisposeCallback(node, () => updateFromModelComputed!.dispose());
      } else {
        updateFromView();
      }
    }, null, { notifyImmediately: true });
  },
  update() {},
};

// ---- Task 26: options binding ----

const CAPTION_PLACEHOLDER = {};

const optionsHandler: BindingHandler = {
  init(node) {
    const el = node as HTMLSelectElement;
    if ((el.tagName || '').toLowerCase() !== 'select') {
      throw new Error('options binding applies only to SELECT elements');
    }
    while (el.options.length > 0) {
      el.removeChild(el.options[0]);
    }
    return { controlsDescendantBindings: true };
  },
  update(node, valueAccessor, allBindings) {
    const el = node as HTMLSelectElement;

    function selectedOptions(): HTMLOptionElement[] {
      return Array.from(el.options).filter(o => o.selected);
    }

    const selectWasPreviouslyEmpty = el.length === 0;
    const multiple = el.multiple;
    const previousScrollTop = (!selectWasPreviouslyEmpty && multiple) ? el.scrollTop : null;
    let unwrappedArray = unwrapObservable(valueAccessor()) as unknown[];
    const valueAllowUnset = allBindings.get('valueAllowUnset') && allBindings.has('value');
    const includeDestroyed = allBindings.get('optionsIncludeDestroyed');
    let filteredArray: unknown[] | undefined;
    let previousSelectedValues: unknown[] = [];

    if (!valueAllowUnset) {
      if (multiple) {
        previousSelectedValues = selectedOptions().map(o => selectExtensions.readValue(o));
      } else if (el.selectedIndex >= 0) {
        previousSelectedValues.push(selectExtensions.readValue(el.options[el.selectedIndex]));
      }
    }

    if (unwrappedArray) {
      if (!Array.isArray(unwrappedArray)) {
        unwrappedArray = [unwrappedArray];
      }

      filteredArray = (unwrappedArray as unknown[]).filter((item: unknown) => {
        return includeDestroyed || item === undefined || item === null ||
          !unwrapObservable((item as Record<string, unknown>)?.['_destroy']);
      });

      if (allBindings.has('optionsCaption')) {
        const captionValue = unwrapObservable(allBindings.get('optionsCaption'));
        if (captionValue !== null && captionValue !== undefined) {
          filteredArray.unshift(CAPTION_PLACEHOLDER);
        }
      }
    }

    function applyToObject(object: unknown, predicate: unknown, defaultValue: unknown): unknown {
      if (typeof predicate === 'function') return (predicate as Function)(object);
      if (typeof predicate === 'string') return (object as Record<string, unknown>)[predicate];
      return defaultValue;
    }

    while (el.options.length > 0) {
      el.removeChild(el.options[0]);
    }

    if (filteredArray) {
      for (let i = 0; i < filteredArray.length; i++) {
        const arrayEntry = filteredArray[i];
        const option = el.ownerDocument.createElement('option') as HTMLOptionElement;

        if (arrayEntry === CAPTION_PLACEHOLDER) {
          option.textContent = String(unwrapObservable(allBindings.get('optionsCaption')) ?? '');
          selectExtensions.writeValue(option, undefined);
        } else {
          const optionValue = applyToObject(arrayEntry, allBindings.get('optionsValue'), arrayEntry);
          selectExtensions.writeValue(option, unwrapObservable(optionValue));

          const optionText = applyToObject(arrayEntry, allBindings.get('optionsText'), optionValue);
          option.textContent = String(unwrapObservable(optionText) ?? '');
        }

        el.appendChild(option);

        if (previousSelectedValues.length) {
          const isSelected = previousSelectedValues.indexOf(selectExtensions.readValue(option)) >= 0;
          option.selected = isSelected;
        }

        if (allBindings.has('optionsAfterRender') && typeof allBindings.get('optionsAfterRender') === 'function') {
          ignore(() => {
            (allBindings.get('optionsAfterRender') as Function)(
              option,
              arrayEntry !== CAPTION_PLACEHOLDER ? arrayEntry : undefined,
            );
          });
        }
      }
    }

    if (!valueAllowUnset) {
      let selectionChanged: boolean;
      if (multiple) {
        selectionChanged = previousSelectedValues.length > 0 && selectedOptions().length < previousSelectedValues.length;
      } else {
        selectionChanged = (previousSelectedValues.length > 0 && el.selectedIndex >= 0)
          ? (selectExtensions.readValue(el.options[el.selectedIndex]) !== previousSelectedValues[0])
          : (previousSelectedValues.length > 0 || el.selectedIndex >= 0);
      }

      if (selectionChanged) {
        ignore(() => triggerEvent(el, 'change'));
      }
    }

    if (valueAllowUnset || isInitial()) {
      bindingEvent.notify(node, bindingEvent.childrenComplete);
    }
  },
};

function isWritableObs(value: unknown): value is Observable<unknown> | Computed<unknown> {
  if (value instanceof Observable) return true;
  if (value instanceof Computed) return value.hasWriteFunction;
  return false;
}

// ---- enter: fires callback on Enter keypress ----

const enterHandler: BindingHandler = {
  init(element, valueAccessor) {
    (element as HTMLElement).addEventListener('keydown', (evt: Event) => {
      if ((evt as KeyboardEvent).key === 'Enter') {
        const callback = valueAccessor();
        if (typeof callback === 'function') {
          callback.call(null, evt);
        }
      }
    });
  },
};

// ---- modal: toggles <dialog> showModal/close based on observable boolean ----

const modalHandler: BindingHandler = {
  init(element, valueAccessor) {
    const dlg = element as HTMLDialogElement;
    const value = unwrapObservable(valueAccessor());
    if (value) dlg.showModal();
  },
  update(element, valueAccessor) {
    const dlg = element as HTMLDialogElement;
    const value = unwrapObservable(valueAccessor());
    if (value) {
      if (!dlg.open) dlg.showModal();
    } else {
      if (dlg.open) dlg.close();
    }
  },
};

// ---- Registration ----

bindingHandlers['text'] = textHandler;
bindingHandlers['html'] = htmlHandler;
bindingHandlers['visible'] = visibleHandler;
bindingHandlers['hidden'] = hiddenHandler;
bindingHandlers['attr'] = attrHandler;
bindingHandlers['class'] = classHandler;
bindingHandlers['css'] = cssHandler;
bindingHandlers['style'] = styleHandler;
bindingHandlers['enable'] = enableHandler;
bindingHandlers['disable'] = disableHandler;
bindingHandlers['uniqueName'] = uniqueNameHandler;

bindingHandlers['event'] = eventHandler;
bindingHandlers['click'] = clickHandler;
bindingHandlers['submit'] = submitHandler;
bindingHandlers['value'] = valueHandler;
bindingHandlers['textInput'] = textInputHandler;
bindingHandlers['textinput'] = textinputAliasHandler;
bindingHandlers['checked'] = checkedHandler;
bindingHandlers['checkedValue'] = checkedValueHandler;
bindingHandlers['hasfocus'] = hasfocusHandler;
bindingHandlers['hasFocus'] = hasfocusHandler;
bindingHandlers['selectedOptions'] = selectedOptionsHandler;
bindingHandlers['options'] = optionsHandler;
bindingHandlers['enter'] = enterHandler;
bindingHandlers['modal'] = modalHandler;

twoWayBindings['value'] = true;
twoWayBindings['textInput'] = true;
twoWayBindings['checked'] = true;
twoWayBindings['hasfocus'] = true;
twoWayBindings['hasFocus'] = 'hasfocus';
twoWayBindings['selectedOptions'] = true;

allowedVirtualElementBindings['text'] = true;
allowedVirtualElementBindings['html'] = true;
