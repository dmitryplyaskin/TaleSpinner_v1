# AGENTS.md - TaleSpinner
Purpose: repository-specific instructions for Codex agents.
(Назначение: правила работы агента именно в этом репозитории.)

## Quick Commands (run from repo root)
- Install deps: `yarn install:all` and `yarn install:docs`
- Dev (server + web): `yarn dev`
- Dev (docs): `yarn docs:dev`
- Build all app parts: `yarn build`
- Build docs: `yarn docs:build`

## Stack Snapshot
- Monorepo: `server` (Node.js + Express + TypeScript), `web` (Vite + React + TypeScript + Effector + Mantine), `docs` (Docusaurus), `shared` (shared TS contracts).
- Package manager: Yarn Classic (1.x). Do not switch to npm/pnpm in tasks.
- Runtime note: docs require Node >= 20 (`docs/package.json` engines).

## Repo Map
- Backend entrypoint: `server/src/index.ts`
- API registry: `server/src/api/_routes_.ts`
- Frontend entrypoint: `web/src/App.tsx`, bootstrap `web/src/main.tsx`
- Frontend state: `web/src/model/*`
- Docs RU: `docs/docs/**`
- Docs EN: `docs/i18n/en/docusaurus-plugin-content-docs/current/**`
- Shared contracts: `shared/**`
- Legacy reference only: `server/src/legacy/**`, `web/src/legacy/**`

## Working Rules
- Keep changes scoped to the user request. No opportunistic refactors.
- Prefer `rg` / `rg --files` for search.
- Before changing code, inspect existing local patterns in neighboring files.
- Do not edit `legacy` folders unless the task explicitly asks for legacy migration.
- Never expose secrets or token values in output.
- Keep code comments in English when adding comments.

## Worktree Startup Rule
- If current repo folder name starts with `TaleSpinner_` and is not `TaleSpinner_v1`, treat it as a git worktree for tasks.
- At the start of each new task in such worktree:
  - run `git fetch origin dev`
  - if current branch is `dev`, `main`, or detached `HEAD`, create and switch to a task branch from `origin/dev` before edits
  - run `sync-db-from-main.bat --no-extra --no-pause` to refresh local DB from the main folder

## Area-Specific Guidance

### Backend (`server/**`)
- Follow existing API style in `server/src/api/*` and shared middleware patterns (`asyncHandler`, `errorHandler`, `validate` where applicable).
- For new or changed endpoints, prefer typed request/response flow and avoid `any`.
- If endpoint behavior changes, ensure API docs inventory can be regenerated.

Required checks after backend changes:
- `yarn typecheck:server`
- Run focused tests in server when logic is touched:
  - all tests: `yarn --cwd server test`
  - or targeted: `yarn --cwd server test -- <name-pattern>`

### Frontend (`web/**`)
- Respect FSD-style boundaries already used in repo (`features`, `model`, `ui`, `api`, `utils`).
- Keep business logic in `model/*` or utilities, not large UI handlers.
- Reuse existing aliases and local conventions.

Required checks after frontend changes:
- `yarn typecheck:web`
- If build/tooling/entrypoint changed: `yarn build:web`

### Docs (`docs/**`)
- Docs are code-adjacent and must match current behavior.
- Keep RU/EN structure parity.
- If API routes changed: regenerate API endpoints docs.

Required checks after docs or API-doc changes:
- `yarn docs:generate:api` (only when API surface changed)
- `yarn docs:check`

### Shared (`shared/**`)
- Any contract change must be validated in both app layers.

Required checks after shared changes:
- `yarn typecheck:server`
- `yarn typecheck:web`

## Definition of Done
- Requested behavior implemented and consistent with neighboring architecture.
- Required scope checks passed.
- If docs touched, RU/EN parity preserved.
- Final report includes:
  - changed files
  - why change was made
  - commands executed
  - test/check results

## Safety & Data Handling
- Treat `server/data/config/*` and env-backed credentials as sensitive.
- Do not add endpoints that return raw secrets.
- Keep static serving restricted to intended public media paths.
- Treat user-provided markdown/HTML as untrusted content.

## Instruction Hygiene (for future edits of this file)
- Keep this file concise, concrete, and command-first.
- Prefer actionable rules over broad style essays.
- If rules become large, split by subdirectories with additional local `AGENTS.md` files.
