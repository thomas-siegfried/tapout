# KoUtility

A comprehensive utility library for Knockout.js that provides enhanced functionality for reactive programming, component management, and common development tasks.

## Installation

```bash
npm install @twodtwenty/koutility
```

## Quick Start

```typescript
// Import the entire library
import "@twodtwenty/koutility";

// Or import specific utilities
import { koprop, koarray, KoComponent } from "@twodtwenty/koutility/ko";
import { Bind } from "@twodtwenty/koutility/bind";
```

## Utilities Overview

### 🎯 Knockout Properties (`/ko`)

Enhanced property decorators and utilities for Knockout.js reactive programming.

#### Property Decorators

```typescript
import {
  koprop,
  koarray,
  kocomputed,
  koinput,
  kooutput,
} from "@twodtwenty/koutility/ko";

class MyViewModel {
  @koprop name = "John";
  @koarray items = [];
  @kocomputed get fullName() {
    return `${this.firstName} ${this.lastName}`;
  }
  @koinput inputValue = ko.observable("initial");
  @kooutput outputValue = ko.observable("output");
}
```

#### Property Management

```typescript
import { getObservable, setObservable } from "@twodtwenty/koutility/ko";

// Get existing observable by key
const nameObs = getObservable(myObject, "name");

// Set a new observable
setObservable(myObject, "name", ko.observable("new value"));
```

#### Property Extenders

```typescript
import { koextend } from "@twodtwenty/koutility/ko";

class MyViewModel {
  @koextend({ required: true })
  @koprop
  requiredField = "";
}
```

### 🧩 Components (`/ko`)

Simplified component creation and management.

```typescript
import { KoComponent, InitializeComponent } from "@twodtwenty/koutility/ko";

@KoComponent("my-component", "<div>Hello {{name}}</div>")
class MyComponent implements InitializeComponent {
  name = ko.observable("World");

  initialize(info: KnockoutComponentTypes.ComponentInfo) {
    // Component initialization logic
  }
}
```

### ⚡ Effects (`/ko`)

Reactive effects and observation utilities.

```typescript
import { observe, effect, observeOnce } from "@twodtwenty/koutility/ko";

// Observe changes and react
observe(
  () => this.name(),
  (newName) => {
    console.log("Name changed to:", newName);
  }
);

// Effect that runs immediately and on changes
effect(
  () => this.items().length,
  (count) => {
    this.updateUI(count);
  }
);

// Observe once and auto-dispose
observeOnce(
  () => this.isLoaded(),
  (loaded) => {
    if (loaded) this.initialize();
  }
);
```

### 🎨 UI Enhancements

#### Modal Binding

```html
<dialog data-bind="modal: showDialog">
  <h2>Modal Content</h2>
  <button data-bind="click: closeDialog">Close</button>
</dialog>
```

#### Enter Key Binding

```html
<input data-bind="value: searchText, enter: performSearch" />
```

#### Delay Extender

```typescript
// Add delay to observable updates (useful for search inputs)
this.searchText = ko.observable("").extend({ delay: 300 });
```

### 🔗 Binding Utilities (`/bind`)

Automatic method binding for class methods.

```typescript
import { Bind } from "@twodtwenty/koutility/bind";

class MyViewModel {
  @Bind
  handleClick() {
    // 'this' is automatically bound to the class instance
    console.log(this.name());
  }
}
```

### 🔄 Array Extensions

Enhanced array methods for common operations.

```typescript
// Remove duplicates
const uniqueItems = items.distinct();

// Sort by property
const sortedUsers = users.sortBy((user) => user.name);

// Sum values
const total = items.sum((item) => item.price);
```

## Module Structure

```
@twodtwenty/koutility/
├── /ko # Knockout utilities and decorators
├── /ko/ko.properties # Property management
├── /ko/component # Component utilities
├── /ko/effects # Reactive effects
├── /ko/modal # Modal binding
├── /ko/custom.elements # Custom element support
├── /ko/delay # Delay extender
├── /bind # Method binding utilities
├── /arrays # Array extensions
└── /keypress # Keyboard event utilities
```

## TypeScript Support

This library is written in TypeScript and includes full type definitions. All decorators and utilities are fully typed for better development experience.

## Requirements

- **Knockout.js**: ^3.5.1
- **TypeScript**: ^4.0.0 (for decorator support)
- **Node.js**: ^16.0.0

## License

ISC License
