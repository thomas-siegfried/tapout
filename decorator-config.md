# Vite Decorator Setup Guide

Four tested configurations for using decorators with Vite 7/8 and tapout.

---

## Option A: Babel + TC39 Stage 3 Decorators

Uses the `accessor` keyword. Babel transpiles TC39 decorators into `_applyDecs` helper calls.

### Install

```bash
npm install -D vite-plugin-babel @babel/plugin-proposal-decorators @babel/plugin-transform-typescript
```

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';

export default defineConfig({
  resolve: {
    preserveSymlinks: true,       // only needed for npm link scenarios
  },
  oxc: false as any,              // disable Vite 8's default Oxc transpiler
  plugins: [
    babel({
      filter: /\.[jt]sx?$/,       // must include .ts/.tsx — default only handles .js/.jsx
      babelConfig: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { version: '2023-11' }],
          ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        ],
      },
    }),
  ],
});
```

### `tsconfig.json`

Do **not** add `experimentalDecorators`. Keep `useDefineForClassFields: true` (the default).

### Source syntax

```typescript
@reactive accessor currentRoute: string = 'dashboard';
@reactiveArray accessor items: Item[] = [];
@computed get fullName(): string { return ... }
```

---

## Option B: Babel + Experimental (Legacy) Decorators

No `accessor` keyword. Babel transpiles legacy decorators. Requires `@babel/plugin-transform-class-properties` with `loose: true` to prevent Babel from creating own data properties that shadow the decorator's getter/setter.

### Install

```bash
npm install -D vite-plugin-babel @babel/plugin-proposal-decorators @babel/plugin-transform-class-properties @babel/plugin-transform-typescript
```

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import babel from 'vite-plugin-babel';

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  oxc: false as any,
  plugins: [
    babel({
      filter: /\.[jt]sx?$/,
      babelConfig: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { version: 'legacy' }],
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-typescript', { allowDeclareFields: true }],
        ],
      },
    }),
  ],
});
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  }
}
```

### Source syntax

```typescript
@reactive currentRoute: string = 'dashboard';
@reactiveArray items: Item[] = [];
@computed get fullName(): string { return ... }
```

### Babel-specific note

Babel passes a `descriptor` with an `initializer` property to legacy field decorators — this is a Babel convention, not a standard. tapout handles this to prevent Babel's class property transform from shadowing the decorator's getter/setter with a plain data property.

---

## Option C: Oxc (Vite 8 built-in) + Experimental (Legacy) Decorators

No Babel needed — Vite 8's built-in Oxc transpiler handles legacy decorators natively. Zero extra dependencies.

### Install

No additional packages needed beyond Vite itself.

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    preserveSymlinks: true,
  },
  oxc: {
    decorator: {
      legacy: true,
    },
  },
});
```

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  }
}
```

### Source syntax

Same as Option B (no `accessor` keyword).

---

## Option D: esbuild (Vite 7 built-in) + Experimental (Legacy) Decorators

No Babel or Oxc needed — Vite 7's built-in esbuild transpiler handles legacy decorators natively by reading `tsconfig.json`. Zero extra dependencies.

### Install

No additional packages needed beyond Vite itself.

```bash
npm install -D vite@~7.3.1
```

### `vite.config.ts`

No `vite.config.ts` is required. esbuild reads `experimentalDecorators` and `useDefineForClassFields` directly from `tsconfig.json` — no explicit esbuild config needed.

### `tsconfig.json`

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  }
}
```

`erasableSyntaxOnly` (added in TypeScript 5.9) must **not** be enabled — it rejects decorator syntax as non-erasable.

### Source syntax

Same as Option B (no `accessor` keyword).

### esbuild-specific notes

- esbuild does **not** support `emitDecoratorMetadata`. tapout does not use `reflect-metadata`, so this is a non-issue.
- esbuild does **not** pass a `descriptor` with an `initializer` to legacy field decorators (unlike Babel). tapout's legacy path handles both cases — with and without the Babel-style `initializer`.

---

## Quick Reference

| | Option A | Option B | Option C | Option D |
|---|---|---|---|---|
| Vite version | 8 | 8 | 8 | 7 |
| Spec | TC39 Stage 3 | Experimental/Legacy | Experimental/Legacy | Experimental/Legacy |
| Transpiler | Babel | Babel | Oxc (built-in) | esbuild (built-in) |
| Extra deps | 2 packages | 3 packages | None | None |
| `accessor` keyword | Yes | No | No | No |
| `experimentalDecorators` | No | Yes | Yes | Yes |
| `useDefineForClassFields` | `true` | `false` | `false` | `false` |
| `emitDecoratorMetadata` | N/A | Supported | Supported | Not supported |

## Common Gotchas

- **`oxc: false as any`** — required for Options A/B to disable Vite 8's default Oxc transpiler so Babel takes over. The `as any` is needed because Vite 8's types don't expose this option.
- **`filter: /\.[jt]sx?$/`** — critical for Babel options. Without it, `.ts` files bypass Babel and hit the default transpiler.
- **`preserveSymlinks: true`** (Vite 8) / **`resolve.dedupe`** (Vite 7) — only needed when using `npm link` for local package development.
- **Plugin order matters** — decorators must come before class-properties, which must come before TypeScript transform (Options A/B only).
- **Vite caches pre-bundled deps** — after changing a linked package, delete `node_modules/.vite` and restart the dev server.
- **`erasableSyntaxOnly: true`** — if present in `tsconfig.json`, must be removed when enabling `experimentalDecorators`. TypeScript 5.9 introduced this flag to enforce type-only syntax, but decorator emit is runtime code.
- **esbuild reads tsconfig automatically** (Option D) — no `vite.config.ts` is needed at all. esbuild picks up `experimentalDecorators` and `useDefineForClassFields` from the project's `tsconfig.json`.
