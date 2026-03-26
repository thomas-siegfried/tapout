import { Window } from 'happy-dom';
import {
  options,
  applyBindings,
  cleanNode,
  Observable,
  enableAll,
  resetConfigured,
  getBindingHandler,
  bindingProviderInstance,
  bindingHandlers,
} from '#src/index.js';

const window = new Window();
const document = window.document;

function createElement(tag: string, attrs: Record<string, string> = {}): Element {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    el.setAttribute(key, val);
  }
  return el as unknown as Element;
}

function resetFeatureFlags(): void {
  options.interpolation = false;
  options.attributeInterpolation = false;
  options.namespacedBindings = false;
  options.filters = false;
  resetConfigured();
}

describe('configure (options feature flags)', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  it('all feature flags default to false', () => {
    expect(options.interpolation).toBe(false);
    expect(options.attributeInterpolation).toBe(false);
    expect(options.namespacedBindings).toBe(false);
    expect(options.filters).toBe(false);
  });

  it('options.namespacedBindings enables namespaced handler resolution on applyBindings', () => {
    options.namespacedBindings = true;

    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keydown.enter: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    const handler = getBindingHandler('keydown.enter');
    expect(handler).toBeDefined();

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('options.interpolation enables {{ }} text interpolation on applyBindings', () => {
    options.interpolation = true;

    const name = new Observable('World');
    const container = createElement('div');
    const span = document.createElement('span');
    span.textContent = '{{ name }}';
    (container as unknown as HTMLElement).appendChild(span);
    document.body.appendChild(container as never);

    applyBindings({ name }, container);

    expect((container as unknown as HTMLElement).textContent).toContain('World');

    cleanNode(container);
    document.body.removeChild(container as never);
  });

  it('options.filters enables filter preprocessor on all bindings on applyBindings', () => {
    options.filters = true;

    const el = createElement('span', { 'data-bind': "text: name | uppercase" });
    document.body.appendChild(el as never);

    applyBindings({ name: 'hello' }, el);

    expect((el as unknown as HTMLElement).textContent).toBe('HELLO');

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('ensureConfigured with no flags does not change flags', () => {
    const el = createElement('span', { 'data-bind': 'text: name' });
    document.body.appendChild(el as never);

    applyBindings({ name: 'hello' }, el);

    expect(options.interpolation).toBe(false);
    expect(options.attributeInterpolation).toBe(false);
    expect(options.namespacedBindings).toBe(false);
    expect(options.filters).toBe(false);

    cleanNode(el);
    document.body.removeChild(el as never);
  });
});

describe('enableAll', () => {
  beforeEach(() => {
    resetFeatureFlags();
  });

  afterEach(() => {
    resetFeatureFlags();
  });

  it('sets all feature flags to true', () => {
    enableAll();

    expect(options.interpolation).toBe(true);
    expect(options.attributeInterpolation).toBe(true);
    expect(options.namespacedBindings).toBe(true);
    expect(options.filters).toBe(true);
  });

  it('enables namespaced bindings', () => {
    enableAll();

    const spy = jasmine.createSpy('handler');
    const el = createElement('input', { 'data-bind': 'keydown.enter: handler' });
    document.body.appendChild(el as never);

    applyBindings({ handler: spy }, el);

    const handler = getBindingHandler('keydown.enter');
    expect(handler).toBeDefined();

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('enables filters on all bindings', () => {
    enableAll();

    const el = createElement('span', { 'data-bind': "text: name | uppercase" });
    document.body.appendChild(el as never);

    applyBindings({ name: 'hello' }, el);

    expect((el as unknown as HTMLElement).textContent).toBe('HELLO');

    cleanNode(el);
    document.body.removeChild(el as never);
  });

  it('is safe to call multiple times', () => {
    enableAll();
    enableAll();

    expect(options.interpolation).toBe(true);
    expect(options.namespacedBindings).toBe(true);
    expect(options.filters).toBe(true);

    const el = createElement('span', { 'data-bind': "text: name | uppercase" });
    document.body.appendChild(el as never);

    applyBindings({ name: 'hello' }, el);
    expect((el as unknown as HTMLElement).textContent).toBe('HELLO');

    cleanNode(el);
    document.body.removeChild(el as never);
  });
});
