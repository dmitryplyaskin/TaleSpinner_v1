# Dependency migration baseline

This repository uses Yarn Classic 1.x and targets Node.js `>=22.22.2`.
`.nvmrc` pins Node.js 22.23.1 so local development and CI can reproduce the
validated runtime.

## Intentional version holds

- TypeScript is pinned to `~6.0.3`. The current `typescript-eslint` peer range
  is `<6.1.0`, and Docusaurus 3.10 still inherits the deprecated `baseUrl`
  option. TypeScript 7 should be adopted only after both upstream toolchains
  support it.
- `@types/node` stays on major 22 to match the supported Node.js runtime. A
  higher current DefinitelyTyped major does not represent this application's
  runtime contract.

## Security resolutions

- Server: `@esbuild-kit/core-utils` is an indirect Drizzle Kit dependency that
  still requests vulnerable esbuild 0.18. It is resolved to esbuild 0.25,
  which is the closest patched API-compatible line and is covered by the
  Drizzle CLI and transform smoke checks.
- Docs: current Docusaurus dependencies still request vulnerable releases of
  `serialize-javascript`, `uuid`, and `brace-expansion`. Yarn resolutions pin
  patched releases. The Docusaurus RU/EN production build validates these
  overrides.

The incompatible-range warnings printed by Yarn for these resolutions are
expected until the corresponding upstream dependency ranges are updated.

## Audit commands

Run `yarn audit` in the repository root and separately in `server`, `web`, and
`docs`. Run `yarn outdated` in the same four locations; only the intentional
TypeScript and Node type holds above should remain.
