# Tapout

A modern ESM reactivity and templating library, spiritually inspired by [KnockoutJS](https://knockoutjs.com/). Not a drop-in replacement — same philosophy, modern implementation.

Tapout provides dependency-tracked observables, computed values, declarative DOM bindings, a component system, and TC39 Stage 3 decorators — all in a lightweight, explicit architecture built on TypeScript.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Core Reactivity](#core-reactivity)
  - [Observable](#observable)
  - [ObservableArray](#observablearray)
  - [Computed](#computed)
  - [PureComputed](#purecomputed)
  - [Effects](#effects)
  - [Subscriptions](#subscriptions)
  - [Events](#events)
- [Extenders](#extenders)
- [Decorators](#decorators)
  - [@reactive](#reactive)
  - [@reactiveArray](#reactivearray)
  - [@computed](#computed-decorator)
  - [getObservable / replaceObservable](#getobservable--replaceobservable)
- [Binding System](#binding-system)
  - [Applying Bindings](#applying-bindings)
  - [Binding Context](#binding-context)
  - [Built-in Bindings](#built-in-bindings)
  - [Virtual Elements](#virtual-elements)
  - [Interpolation Markup](#interpolation-markup)
  - [Attribute Interpolation](#attribute-interpolation)
  - [Namespaced Bindings](#namespaced-bindings)
  - [Filters](#filters)
- [Components](#components)
  - [Registration](#registration)
  - [The @component Decorator](#the-component-decorator)
  - [Templates](#templates)
  - [View Models](#view-models)
  - [Params and Wiring](#params-and-wiring)
  - [Lifecycle](#lifecycle)
  - [Slots](#slots)
  - [Custom Elements](#custom-elements)
- [Utilities](#utilities)
- [Configuration](#configuration)
- [Acknowledgments](#acknowledgments)

---

## Installation

```bash
npm install tapout
```

Tapout is ESM-only and requires a modern bundler or runtime that supports ES modules.

## Quick Start

```typescript
import { Observable, Computed, applyBindings } from 'tapout';

class ViewModel {
  firstName = new Observable('Jane');
  lastName = new Observable('Doe');
  fullName = new Computed(() => `${this.firstName.get()} ${this.lastName.get()}`);
}

applyBindings(new ViewModel(), document.body);
```

```html
<p>First: <input data-bind="textInput: firstName" /></p>
<p>Last: <input data-bind="textInput: lastName" /></p>
<h2 data-bind="text: fullName"></h2>
```

Or with decorators:

```typescript
import { reactive, computed, applyBindings } from 'tapout';

class ViewModel {
  @reactive accessor firstName = 'Jane';
  @reactive accessor lastName = 'Doe';

  @computed get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }
}

applyBindings(new ViewModel(), document.body);
```

---

## Core Reactivity

### Observable

A mutable reactive value. Reading inside a computed or effect automatically registers a dependency.

```typescript
import { Observable } from 'tapout';

const count = new Observable(0);

count.get();    // 0 — reads the value (tracks dependency)
count.peek();   // 0 — reads without tracking
count.set(5);   // writes a new value, notifies subscribers
```

Setting the same primitive value again does not trigger notifications. For objects and arrays, every `set()` notifies regardless of reference equality. You can customize this behavior:

```typescript
count.equalityComparer = (a, b) => a === b;
count.equalityComparer = undefined; // always notify
```

Force a notification after in-place mutation:

```typescript
const data = new Observable({ name: 'Alice' });
data.peek().name = 'Bob';
data.valueHasMutated();
```

Type guard: `isObservable(value)`.

### ObservableArray

An `Observable<T[]>` with array-like methods that automatically notify on mutation.

```typescript
import { ObservableArray } from 'tapout';

const items = new ObservableArray(['a', 'b', 'c']);

items.push('d');
items.remove('b');
items.splice(0, 1, 'x');
```

**Mutators** (all trigger change notifications): `push`, `pop`, `shift`, `unshift`, `splice`, `sort`, `reverse`, `remove`, `removeAll`, `destroy`, `destroyAll`, `replace`.

**Readers** (all track dependencies): `length`, `indexOf`, `slice`, `sorted`, `reversed`, `map`, `filter`, `find`, `findIndex`, `some`, `every`, `forEach`, `reduce`, `includes`, `at`, `join`, `flat`, `flatMap`, `entries`, `keys`, `values`, `[Symbol.iterator]`.

**Array change tracking** — subscribe to the `arrayChange` event to receive fine-grained diffs:

```typescript
items.subscribe(changes => {
  for (const change of changes) {
    console.log(change.status, change.value, change.index);
  }
}, 'arrayChange');
```

Each change has `status` (`'added'`, `'deleted'`, or `'retained'`), `value`, `index`, and optionally `moved`.

Type guard: `isObservableArray(value)`.

### Computed

A derived value that automatically re-evaluates when its dependencies change.

```typescript
import { Observable, Computed } from 'tapout';

const width = new Observable(10);
const height = new Observable(20);
const area = new Computed(() => width.get() * height.get());

area.get(); // 200
width.set(5);
area.get(); // 100
```

Computed values only notify their subscribers when the result actually changes.

**Writable computed** — provide a `write` function to enable two-way usage:

```typescript
const first = new Observable('Jane');
const last = new Observable('Doe');

const full = new Computed({
  read: () => `${first.get()} ${last.get()}`,
  write: (value: string) => {
    const [f, l] = value.split(' ');
    first.set(f);
    last.set(l);
  },
});

full.set('John Smith'); // updates first and last
```

**Deferred evaluation** — delay the first evaluation until the value is actually needed:

```typescript
const lazy = new Computed({
  read: () => expensiveCalc(),
  deferEvaluation: true,
});
```

**Inspection:**

```typescript
area.getDependenciesCount(); // 2
area.getDependencies();      // [width, height]
area.isActive();             // true if it has dependencies
area.hasWriteFunction;       // boolean
```

Call `area.dispose()` to stop tracking and release all dependency subscriptions.

Type guard: `isComputed(value)`.

### PureComputed

A memory-optimized computed that *sleeps* when it has no subscribers, releasing its dependency subscriptions. It *wakes* automatically when someone subscribes.

```typescript
import { PureComputed } from 'tapout';

const label = new PureComputed(() => `Count: ${count.get()}`);
```

Use `PureComputed` for values that are only needed intermittently (e.g., computed values backing a UI that may or may not be in the DOM). It is the default backing for `@computed` decorators.

Type guards: `isPureComputed(value)`, `isComputed(value)`.

### Effects

Side-effect helpers that track reactive dependencies and re-run when they change.

```typescript
import { Observable, effect, observe } from 'tapout';

const name = new Observable('Alice');

// effect: runs immediately, then again on each change
const handle = effect(
  () => name.get(),
  val => console.log(`Hello, ${val}!`),
);
// logs: "Hello, Alice!"

name.set('Bob');
// logs: "Hello, Bob!"

handle.dispose(); // stop watching
```

```typescript
// observe: does NOT run immediately — only fires on subsequent changes
const handle = observe(
  () => name.get(),
  val => console.log(`Changed to ${val}`),
);

name.set('Charlie');
// logs: "Changed to Charlie"
```

Both functions return an `EffectHandle`:

```typescript
interface EffectHandle {
  dispose(): void;
}
```

Calling `dispose()` stops the effect, releasing the internal computed and its dependency subscriptions.

### Subscriptions

Every `Subscribable` (Observable, Computed, etc.) supports subscriptions:

```typescript
const sub = count.subscribe(value => {
  console.log('New value:', value);
});

sub.closed;   // false
sub.dispose(); // unsubscribe
sub.closed;   // true
```

**Events** — the second argument selects the event channel:


| Event                | Fires when                                      |
| -------------------- | ----------------------------------------------- |
| `'change'` (default) | After the value changes                         |
| `'beforeChange'`     | Before a new value is written                   |
| `'spectate'`         | On every write, regardless of equality          |
| `'dirty'`            | Synchronously when a deferred value is dirtied  |
| `'awake'`            | When a PureComputed wakes up                    |
| `'asleep'`           | When a PureComputed goes to sleep               |
| `'arrayChange'`      | Fine-grained array diffs (ObservableArray only) |


```typescript
count.subscribe(oldVal => console.log('Was:', oldVal), 'beforeChange');
```

**Auto-dispose with DOM nodes:**

```typescript
sub.disposeWhenNodeIsRemoved(someElement);
```

The subscription is automatically disposed when the DOM node is cleaned or removed.

### Events

Events are stateless, hot signals — like observables that don't hold a value. They emit values on demand, and only active subscribers receive them.

An `Event` has a **two-sided** design (similar to Deferred/Promise): the owner calls `emit()`, and consumers receive the read-only `subscribable` side.

```typescript
import { Event } from 'tapout';

class SaveEvent {
  constructor(public id: number, public success: boolean) {}
}

class MyService {
  private _onSave = new Event<SaveEvent>();
  readonly onSave = this._onSave.subscribable; // hand this out

  save(id: number) {
    // ... perform save ...
    this._onSave.emit(new SaveEvent(id, true));
  }
}

const service = new MyService();
const sub = service.onSave.subscribe(e => {
  console.log(`Saved item ${e.id}`);
});

service.save(42); // logs: Saved item 42
sub.dispose();    // stop listening
```

**Type-filtered subscriptions** — use `.on(Type)` to subscribe to only matching event types via `instanceof`:

```typescript
class DeleteEvent {
  constructor(public id: number) {}
}

const event = new Event<SaveEvent | DeleteEvent>();

event.subscribable.on(SaveEvent).subscribe(e => {
  console.log(`Save: ${e.id}`);   // only SaveEvent instances
});

event.subscribable.on(DeleteEvent).subscribe(e => {
  console.log(`Delete: ${e.id}`); // only DeleteEvent instances
});
```

**Aggregate events** — roll up multiple event sources into one, like DOM event bubbling through a tree:

```typescript
import { Event, AggregateEvent } from 'tapout';

class ItemChangedEvent {
  constructor(public itemId: number) {}
}

class GrandChild {
  private _onChange = new Event<ItemChangedEvent>();
  readonly events = new AggregateEvent<ItemChangedEvent>();

  constructor() {
    this.events.pipe(this._onChange.subscribable);
  }

  change(id: number) { this._onChange.emit(new ItemChangedEvent(id)); }
}

class Child {
  private _onSave = new Event<SaveEvent>();
  private _onDelete = new Event<DeleteEvent>();
  readonly grandChild = new GrandChild();

  // Roll up own events + grandchild's aggregate
  readonly events = new AggregateEvent<SaveEvent | DeleteEvent | ItemChangedEvent>();

  constructor() {
    this.events.pipe(
      this._onSave.subscribable,
      this._onDelete.subscribable,
      this.grandChild.events.subscribable,
    );
  }
}

const child = new Child();

// Subscribe to everything in the tree
child.events.subscribable.subscribe(e => {
  console.log('Something happened:', e);
});

// Or filter to a specific type
child.events.subscribable.on(SaveEvent).subscribe(e => {
  console.log(`Save: ${e.id}`);
});
```

`pipe()` accepts multiple sources in a single call and can be called again to add sources later. It returns an array of `EventSubscription` objects for individual disposal.

Events are **hot** — no replay, no current value. If nobody is listening when `emit()` is called, the value is lost. Calling `dispose()` on an Event tears down all subscriptions (including piped sources on an `AggregateEvent`).

**DisposableGroup** — a utility for centralized subscription cleanup. Works with both `Subscription` (from observables) and `EventSubscription` (from events):

```typescript
import { DisposableGroup, Observable, Event } from 'tapout';

class MyComponent {
  private _subs = new DisposableGroup();
  readonly count = new Observable(0);

  constructor(events: EventSubscribable<SaveEvent>) {
    this._subs.add(events.subscribe(e => this.onSave(e)));
    this._subs.add(this.count.subscribe(v => console.log('Count:', v)));
  }

  dispose() {
    this._subs.dispose(); // cleans up all subscriptions at once
  }
}
```

`add()` returns the disposable, so you can still hold a reference for early individual disposal. Any items added after the group is already disposed are immediately disposed.

---

## Extenders

Extenders modify the notification behavior of any subscribable.

```typescript
const search = new Observable('');

// Debounce: wait until changes stop for 300ms before notifying
search.extend({ rateLimit: { timeout: 300, method: 'notifyWhenChangesStop' } });

// Throttle: notify at most once every 200ms (default method)
search.extend({ rateLimit: 200 });

// Always notify, even when value hasn't changed
search.extend({ notify: 'always' });

// Defer notifications to the microtask queue
search.extend({ deferred: true });
```

`extend()` returns the same instance, so calls can be chained.

### Custom Extenders

```typescript
import { registerExtender } from 'tapout';

registerExtender('logChanges', (target, label) => {
  target.subscribe(val => console.log(`[${label}]`, val));
});

const obs = new Observable(0);
obs.extend({ logChanges: 'myObs' });
```

### Global Deferred Updates

Enable deferred notifications for all new observables and computeds:

```typescript
import { options } from 'tapout';

options.deferUpdates = true;
```

When enabled, multiple synchronous writes are batched into a single notification on the next microtask.

---

## Decorators

Tapout provides TC39 Stage 3 class decorators for a cleaner syntax. These work with TypeScript 5.0+ and the `--experimentalDecorators` flag is **not** needed — these are native decorators.

### @reactive

Turns a class accessor into an `Observable`-backed property.

```typescript
import { reactive } from 'tapout';

class Settings {
  @reactive accessor theme = 'dark';
  @reactive accessor fontSize = 14;
}

const s = new Settings();
s.theme;          // 'dark' (reads the Observable, tracks dependency)
s.theme = 'light'; // writes through to the Observable, notifies subscribers
```

Pass extender options:

```typescript
@reactive({ notify: 'always' }) accessor tag = '';
@reactive({ deferred: true }) accessor query = '';
```

### @reactiveArray

Turns a class accessor into an `ObservableArray`-backed property.

```typescript
import { reactiveArray } from 'tapout';

class TodoList {
  @reactiveArray accessor items: string[] = [];
}

const list = new TodoList();
(list.items as any).push('Buy milk');  // mutates the ObservableArray
list.items.length;                     // 1
```

The getter returns the `ObservableArray` instance directly. The setter calls `set()` on the underlying array.

### @computed (decorator)

Works on getters, getter+setter pairs, and methods.

```typescript
import { reactive, computed } from 'tapout';

class FullName {
  @reactive accessor first = 'John';
  @reactive accessor last = 'Doe';

  @computed get full() {
    return `${this.first} ${this.last}`;
  }
  set full(v: string) {
    [this.first, this.last] = v.split(' ');
  }

  @computed nameLength() {
    return this.first.length + this.last.length;
  }
}
```

- Getters create a read-only `Computed` per instance (with `deferEvaluation: true`)
- Getter+setter pairs create a writable `Computed`
- Methods become computed-backed — calling returns the computed value

### getObservable / replaceObservable

Retrieve or replace the underlying reactive primitive for a decorated property:

```typescript
import { getObservable, replaceObservable } from 'tapout';

const obs = getObservable(instance, 'theme');
// returns the Observable, ObservableArray, or Computed backing the property

replaceObservable(instance, 'theme', anotherObservable);
// swap the backing observable (used internally by wireParams for two-way binding)
```

---

## Binding System

### Applying Bindings

```typescript
import { applyBindings } from 'tapout';

const vm = new ViewModel();
applyBindings(vm, document.getElementById('app'));
```


| Function                                   | Purpose                                 |
| ------------------------------------------ | --------------------------------------- |
| `applyBindings(vm, rootNode)`              | Bind a view model to a DOM subtree      |
| `applyBindingsToDescendants(vm, rootNode)` | Bind only the children, not the root    |
| `applyBindingsToNode(node, bindings, vm?)` | Bind specific bindings to a single node |


### Binding Context

Inside bindings, the following context properties are available:


| Property                  | Description                                   |
| ------------------------- | --------------------------------------------- |
| `$data`                   | The current data item                         |
| `$rawData`                | The raw (possibly observable) data            |
| `$root`                   | The root view model                           |
| `$parent`                 | The parent's `$data`                          |
| `$parentContext`          | The parent binding context                    |
| `$parents`                | Array of all ancestor `$data` values          |
| `$index`                  | Current item index (inside `foreach`)         |
| `$component`              | The component view model (inside components)  |
| `$componentTemplateNodes` | Original child nodes of the component element |


Inspect the context of a DOM node programmatically:

```typescript
import { contextFor, dataFor } from 'tapout';

const ctx = contextFor(someElement); // BindingContext
const data = dataFor(someElement);   // $data
```

### Built-in Bindings

#### Display


| Binding   | Example                         | Description             |
| --------- | ------------------------------- | ----------------------- |
| `text`    | `data-bind="text: message"`     | Sets text content       |
| `html`    | `data-bind="html: richContent"` | Sets innerHTML          |
| `visible` | `data-bind="visible: isShown"`  | Toggles `display: none` |
| `hidden`  | `data-bind="hidden: isShown"`   | Inverse of `visible`    |


#### Attributes


| Binding | Examplee                                      | Description                     |
| ------- | --------------------------------------------- | ------------------------------- |
| `attr`  | `data-bind="attr: { href: url, title: tip }"` | Sets/removes attributes         |
| `css`   | `data-bind="css: { active: isActive }"`       | Toggles CSS classes             |
| `class` | `data-bind="class: className"`                | Sets the class attribute string |
| `style` | `data-bind="style: { color: textColor }"`     | Sets inline styles              |


#### Form State


| Binding      | Example                           | Description                              |
| ------------ | --------------------------------- | ---------------------------------------- |
| `enable`     | `data-bind="enable: canSubmit"`   | Enables/disables the element             |
| `disable`    | `data-bind="disable: isReadOnly"` | Inverse of `enable`                      |
| `uniqueName` | `data-bind="uniqueName: true"`    | Auto-generates a unique `name` attribute |


#### Events


| Binding  | Example                                     | Description                            |
| -------- | ------------------------------------------- | -------------------------------------- |
| `event`  | `data-bind="event: { mouseover: onHover }"` | Binds one or more event handlers       |
| `click`  | `data-bind="click: onClick"`                | Shorthand for click events             |
| `submit` | `data-bind="submit: onSubmit"`              | Form submit handler (prevents default) |
| `enter`  | `data-bind="enter: onEnter"`                | Fires callback on Enter key            |


Event handlers receive `$data` as the first argument and the DOM event as the second. Return `true` from a handler to allow default browser behavior. Control bubbling with `eventNameBubble: false`:

```html
<button data-bind="click: onClick, clickBubble: false">Click</button>
```

#### Form Values (Two-Way)


| Binding           | Example                               | Description                                 |
| ----------------- | ------------------------------------- | ------------------------------------------- |
| `value`           | `data-bind="value: selectedItem"`     | Two-way value binding (updates on `change`) |
| `textInput`       | `data-bind="textInput: query"`        | Live text binding (updates on `input`)      |
| `checked`         | `data-bind="checked: isAgreed"`       | Checkbox/radio two-way binding              |
| `checkedValue`    | `data-bind="checkedValue: itemId"`    | Sets the value sent when checked            |
| `hasFocus`        | `data-bind="hasFocus: isFocused"`     | Two-way focus binding                       |
| `selectedOptions` | `data-bind="selectedOptions: chosen"` | Multi-select binding                        |
| `options`         | `data-bind="options: items"`          | Populates a `<select>` from an array        |


The `options` binding supports additional parameters:

```html
<select data-bind="options: people,
                   optionsText: 'name',
                   optionsValue: 'id',
                   optionsCaption: 'Choose...',
                   value: selectedPersonId">
</select>
```

The `checked` binding supports array mode for checkbox groups:

```html
<input type="checkbox" data-bind="checked: selectedColors, checkedValue: 'red'" />
<input type="checkbox" data-bind="checked: selectedColors, checkedValue: 'blue'" />
```

#### Control Flow


| Binding    | Example                                  | Description                                |
| ---------- | ---------------------------------------- | ------------------------------------------ |
| `if`       | `data-bind="if: isLoggedIn"`             | Conditionally renders content              |
| `ifnot`    | `data-bind="ifnot: isEmpty"`             | Inverse conditional                        |
| `with`     | `data-bind="with: selectedItem"`         | Creates a child context; hides when falsy  |
| `using`    | `data-bind="using: config"`              | Like `with` but always renders             |
| `let`      | `data-bind="let: { x: computedVal }"`    | Extends context with additional properties |
| `foreach`  | `data-bind="foreach: items"`             | Iterates over an array                     |
| `template` | `data-bind="template: { name: 'tmpl' }"` | Renders a named or anonymous template      |


The `foreach` binding creates a child context for each item with `$data`, `$index`, and `$parent`:

```html
<ul data-bind="foreach: people">
  <li>
    <span data-bind="text: $index"></span>:
    <span data-bind="text: name"></span>
  </li>
</ul>
```

Use `as` to alias the item:

```html
<ul data-bind="foreach: { data: people, as: 'person' }">
  <li data-bind="text: person.name"></li>
</ul>
```

#### Dialog


| Binding | Example                           | Description                                   |
| ------- | --------------------------------- | --------------------------------------------- |
| `modal` | `data-bind="modal: isDialogOpen"` | Calls `showModal()`/`close()` on a `<dialog>` |


### Virtual Elements

Use HTML comments for bindings that don't need a wrapper element:

```html
<!-- tap if: showSection -->
  <p>Conditional content</p>
<!-- /tap -->

<!-- tap foreach: items -->
  <span data-bind="text: $data"></span>
<!-- /tap -->
```

The following bindings support virtual elements: `text`, `html`, `if`, `ifnot`, `with`, `let`, `using`, `foreach`, `template`, `component`, `slot`.

### Interpolation Markup

Enable text interpolation for a more template-like syntax:

```typescript
import { enableInterpolationMarkup } from 'tapout';
enableInterpolationMarkup();
```

Then use `{{ }}` in your HTML:

```html
<span>Hello, {{ name }}!</span>

<!-- Raw HTML (triple braces) -->
<div>{{{ richContent }}}</div>

<!-- Block control flow -->
{{# if isLoggedIn }}
  <p>Welcome back, {{ username }}!</p>
{{/ if }}
```

### Attribute Interpolation

Enable interpolation inside HTML attributes:

```typescript
import { enableAttributeInterpolationMarkup } from 'tapout';
enableAttributeInterpolationMarkup();
```

```html
<a href="{{ baseUrl }}/profile/{{ userId }}">Profile</a>
<img title="Photo of {{ name }}" />
```

### Namespaced Bindings

Enable shorthand dot-notation for attribute-like bindings:

```typescript
import { enableNamespacedBindings } from 'tapout';
enableNamespacedBindings();
```

```html
<a data-bind="attr.href: profileUrl, css.active: isSelected">Link</a>
<div data-bind="style.color: textColor, event.click: onClick"></div>
```

### Filters

Add pipe-style filters to binding values:

```typescript
import { enableTextFilter } from 'tapout';

enableTextFilter('text');
enableTextFilter('html');
```

```html
<span data-bind="text: name | uppercase"></span>
<span data-bind="text: bio | default:'No bio provided'"></span>
<span data-bind="text: data | json"></span>
```

**Built-in filters:** `uppercase`, `lowercase`, `default`, `json`.

**Custom filters:**

```typescript
import { filters } from 'tapout';

filters['truncate'] = (value: string, maxLength: number) => {
  return value.length > maxLength ? value.slice(0, maxLength) + '...' : value;
};
```

```html
<span data-bind="text: description | truncate:100"></span>
```

Filters work in both `data-bind` attributes and `{{ }}` interpolation.

---

## Components

### Registration

```typescript
import { components } from 'tapout';

components.register('user-card', {
  template: '<div><span data-bind="text: name"></span></div>',
  viewModel: UserCardViewModel,
  synchronous: true,
});
```

Use them in HTML:

```html
<user-card params="name: userName"></user-card>
```

Or with the `component` binding:

```html
<div data-bind="component: { name: 'user-card', params: { name: userName } }"></div>
```

### The @component Decorator

Register components declaratively:

```typescript
import { component, reactive } from 'tapout';

@component('user-card', '<div><span data-bind="text: name"></span></div>')
class UserCard {
  @reactive accessor name = '';
}
```

Or with options:

```typescript
@component({ tag: 'user-card', template: '<div>...</div>', synchronous: true })
class UserCard { ... }
```

Retrieve the tag from a class or instance:

```typescript
import { getComponentTag } from 'tapout';
getComponentTag(UserCard);      // 'user-card'
getComponentTag(new UserCard()); // 'user-card'
```

### Templates

Templates can be provided as:

- A **string** of HTML
- A **DOM element** or `DocumentFragment`
- An **array of nodes**
- `{ element: 'template-id' }` — references a `<template>`, `<script>`, or other element by ID

### View Models

The `viewModel` config accepts:

- A **class constructor** — a new instance is created per component
- `{ createViewModel(params, componentInfo) }` — factory function
- `{ instance: existingObject }` — shared singleton instance

### Params and Wiring

Pass parameters to components via the `params` attribute:

```html
<user-card params="name: userName, age: 30"></user-card>
```

Inside the component, `wireParams` connects parameters to `@reactive` properties:

- **Plain values** are assigned directly
- **Computed params** create a one-way subscription (parent updates flow to child)
- **Observable params** with `$`-prefix enable two-way binding by sharing the backing observable

```html
<!-- Two-way: child and parent share the same Observable -->
<user-card params="name: $sharedName"></user-card>
```

The `$`-prefix syntax passes the parent's raw `Observable` so both sides read and write the same value.

You can also call `wireParams` manually:

```typescript
import { wireParams } from 'tapout';

const result = wireParams(viewModelInstance, params);
// result.subscriptions — array of subscriptions to dispose later
```

### Lifecycle

Component view models can implement these lifecycle methods:

1. `**onInit()**` — Called after VM creation and param wiring, before template binding. Use for initial setup.
2. `**onDescendantsComplete(node)**` — Called after all descendant bindings are complete. Good for DOM measurement or third-party widget initialization.
3. `**dispose()**` — Called when the component's DOM node is cleaned. Use for cleanup.

```typescript
@component('my-widget', '<div>...</div>')
class MyWidget {
  @reactive accessor data = '';

  onInit() {
    // fetch initial data, set up state
  }

  onDescendantsComplete(node: Node) {
    // DOM is ready, descendants are bound
  }

  dispose() {
    // clean up subscriptions, timers, etc.
  }
}
```

Execution order: `onInit` → template binding → `onDescendantsComplete` → (on cleanup) → `dispose`.

### Slots

Project content from a component's consumer into its template using the `slot` binding.

**Component template:**

```html
<div class="card">
  <header data-bind="slot: 'header'">Default Header</header>
  <div data-bind="slot: ''">Default body content</div>
  <footer data-bind="slot: 'footer'">Default Footer</footer>
</div>
```

**Usage:**

```html
<my-card>
  <h2 slot="header">Custom Title</h2>
  <p>This goes into the default slot.</p>
  <small slot="footer">Custom footer</small>
</my-card>
```

Slotted content binds in the **parent** context, not the component's context. Fallback content inside the slot binding is shown when no matching content is provided.

### Custom Elements

Any registered component is automatically detected as a custom element. Tapout applies `display: contents` to custom elements by default so they don't affect layout. Disable this with:

```typescript
import { options } from 'tapout';
options.customElementDisplayContents = false;
```

---

## Utilities

### toJS / toJSON

Deep-unwrap all observables in an object graph:

```typescript
import { toJS, toJSON } from 'tapout';

const plain = toJS(viewModel);         // plain JS object, no observables
const json = toJSON(viewModel, null, 2); // JSON string
```

Handles nested objects, arrays, `ObservableArray`, `Date`, `RegExp`, and circular references.

### when

Wait for a reactive condition to become truthy:

```typescript
import { when } from 'tapout';

// With callback — returns a disposable Subscription
const sub = when(() => items.length > 0, () => {
  console.log('Items loaded!');
});

// Without callback — returns a Promise
await when(() => isReady.get());
```

`when` is one-shot: once the condition is met, the subscription is automatically disposed.

### unwrapObservable / peekObservable

```typescript
import { unwrapObservable, peekObservable } from 'tapout';

unwrapObservable(obs);  // recursively unwraps observables (up to 10 levels)
peekObservable(obs);    // same but uses peek() — no dependency tracking
```

### DOM Utilities

```typescript
import { cleanNode, removeNode, addDisposeCallback } from 'tapout';

addDisposeCallback(element, () => {
  // runs when the node is cleaned or removed
});

cleanNode(element);  // run dispose callbacks, clear data, recurse into children
removeNode(element); // clean + remove from parent
```

---

## Configuration

The `options` object controls global behavior:

```typescript
import { options } from 'tapout';
```


| Option                         | Default                | Description                                                         |
| ------------------------------ | ---------------------- | ------------------------------------------------------------------- |
| `deferUpdates`                 | `false`                | Auto-apply `deferred` extender to all new observables and computeds |
| `onError`                      | `null`                 | Global error handler for deferred task failures                     |
| `viewModelFactory`             | `(ctor) => new ctor()` | Factory for component VM instantiation (useful for DI)              |
| `customElementDisplayContents` | `true`                 | Apply `display: contents` to custom elements                        |


---

## Acknowledgments

Tapout is built on the ideas and philosophy of [KnockoutJS](https://knockoutjs.com/), created by **Steve Sanderson**. Knockout pioneered the pattern of simple, explicit, dependency-tracked reactivity with declarative DOM bindings, and that core vision remains at the heart of Tapout.

Tapout's interpolation markup, filter syntax, namespaced bindings, and preprocessor infrastructure are directly inspired by [Knockout.Punches](https://mbest.github.io/knockout.punches/), created by **Michael Best**.

Thank you to both authors for their foundational work.

---

## License

MIT