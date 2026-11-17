# @repo/typescript-config

The shared TypeScript base config for every package in the workspace. It's strict, with `noUncheckedIndexedAccess`, `noImplicitOverride` and `verbatimModuleSyntax`, and uses bundler module resolution. It never emits files: Vite+ handles type checking and builds.

Each package extends it in its own `tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/tsconfig.base.json",
  "include": ["src", "__tests__"]
}
```

Add it as a dev dependency with `workspace:*`.
