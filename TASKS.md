# Tapout Implementation Tasks

## Phase 1 — Reactivity Core

- [x] 1. Subscribable (base class for all reactive primitives)
- [x] 2. Dependency Detection (stack-based tracking engine)
- [x] 3. Observable (read/write reactive value)
- [x] 4a. Computed — basic (derived observable with dependency tracking)
- [x] 4b. Computed — writable (supports a write function)
- [x] 4c. Pure Computed (sleep/wake optimization)
- [x] 4d. Computed — deferred evaluation (lazy first eval)
- [x] 5. Observable Array (array mutations with change tracking)
- [x] 6. Extenders (`notify`, `rateLimit`; `deferred` deferred to Phase 2 with microtask scheduler)
- [x] 7. Utilities — `toJS`, `toJSON`, `when`

## Phase 2 — Infrastructure for Bindings

- [x] 8. DOM Data Storage (per-node key/value via WeakMap)
- [x] 9. DOM Node Disposal (cleanup callbacks on node removal)
- [x] 10. Virtual Elements (`<!-- ko -->` comment-based containers)
- [x] 11. Expression Rewriting / Binding Parser
- [x] 12. Microtask Scheduler

## Phase 3 — Binding System

- [x] 13. Binding Context (`$data`, `$parent`, `$root`, etc.)
- [x] 14. Binding Provider (reads `data-bind` attributes)
- [x] 15. `applyBindings` Core (DOM tree walk, init/update lifecycle)
- [x] 16. Binding Events (`childrenComplete`, `descendantsComplete`)

## Phase 4 — Built-in Bindings (Simple)

- [x] 17. One-way display: `text`, `html`, `visible`, `hidden`
- [x] 18. Attribute bindings: `attr`, `css`, `class`, `style`
- [x] 19. Form state: `enable`, `disable`, `uniqueName`

## Phase 5 — Built-in Bindings (Complex / Two-Way)

- [x] 20. Event bindings: `event`, `click`, `submit`
- [x] 21. `value` binding
- [x] 22. `textInput` binding
- [x] 23. `checked` / `checkedValue`
- [x] 24. `hasfocus` / `hasFocus`
- [x] 25. `selectedOptions`
- [x] 26. `options`

## Phase 6 — Control Flow & Templates

- [x] 27. Template Sources & Template Engine
- [x] 28. `if` / `ifnot` bindings
- [x] 29. `with` / `using` / `let` bindings
- [x] 30. `foreach` binding (array diff algorithm + DOM sync)

## Phase 7 — Components

- [x] 31. Component Registration & Loader Pipeline
- [x] 32. `component` Binding Handler
- [x] 33. Custom Elements (`<my-component>`)

## Phase 8 — Polish & Advanced

- [x] 34. Select Extensions (arbitrary JS objects as option values)
- [x] 35. Memoization (deferred binding via comment markers)
- [x] 36. Template Rewriting
- [x] 37. Global `options.deferUpdates` (auto-apply deferred extender to all new observables/computeds)

## Phase 9 — Naming Cleanup

- [x] 38. Rename `_ko_property_writers` to `_tap_property_writers` (expressionRewriting.ts + specs)
- [x] 39. Rename `koDescendantsComplete` to `onDescendantsComplete` (componentBinding.ts)
- [x] 40. Fix `ko.computed` error message in computed.ts

## Phase 10 — Missing Features

- [ ] 41. Global error handler (`onError` option for wrapping internal callbacks)
- [ ] 42. Version export (`version` string for debugging/tooling)
- [ ] 43. `Subscription.disposeWhenNodeIsRemoved(node)` convenience method
- [ ] 44. Export `peekObservable` utility from utils.ts
