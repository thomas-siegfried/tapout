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
- [ ] 12. Microtask Scheduler

## Phase 3 — Binding System

- [ ] 13. Binding Context (`$data`, `$parent`, `$root`, etc.)
- [ ] 14. Binding Provider (reads `data-bind` attributes)
- [ ] 15. `applyBindings` Core (DOM tree walk, init/update lifecycle)
- [ ] 16. Binding Events (`childrenComplete`, `descendantsComplete`)

## Phase 4 — Built-in Bindings (Simple)

- [ ] 17. One-way display: `text`, `html`, `visible`, `hidden`
- [ ] 18. Attribute bindings: `attr`, `css`, `class`, `style`
- [ ] 19. Form state: `enable`, `disable`, `uniqueName`

## Phase 5 — Built-in Bindings (Complex / Two-Way)

- [ ] 20. Event bindings: `event`, `click`, `submit`
- [ ] 21. `value` binding
- [ ] 22. `textInput` binding
- [ ] 23. `checked` / `checkedValue`
- [ ] 24. `hasfocus` / `hasFocus`
- [ ] 25. `selectedOptions`
- [ ] 26. `options`

## Phase 6 — Control Flow & Templates

- [ ] 27. Template Sources & Template Engine
- [ ] 28. `if` / `ifnot` bindings
- [ ] 29. `with` / `using` / `let` bindings
- [ ] 30. `foreach` binding (array diff algorithm + DOM sync)

## Phase 7 — Components

- [ ] 31. Component Registration & Loader Pipeline
- [ ] 32. `component` Binding Handler
- [ ] 33. Custom Elements (`<my-component>`)

## Phase 8 — Polish & Advanced

- [ ] 34. Select Extensions (arbitrary JS objects as option values)
- [ ] 35. Memoization (deferred binding via comment markers)
- [ ] 36. Template Rewriting
