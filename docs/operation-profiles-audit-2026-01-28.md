# Operation Profiles (sidebar) — audit (2026-01-28)

Scope: `web/src/features/sidebars/operation-profiles/*` + related model `web/src/model/operation-profiles/index.ts` + shared UI wrappers `web/src/ui/form-components/*`.

This audit focuses on **performance**, **architecture**, **patterns**, and **UI/UX** problems that explain the reported lag and confusing layout.

---

## Executive summary

- **Main perf root-cause (Drawer editor)**: the Drawer renders **all operations at once** and each operation renders **many controlled inputs** (`react-hook-form` via `useController` wrappers). With 10+ operations this becomes a re-render storm and causes **typing lag**.
- **Node editor feels better** mostly because it edits **one operation at a time** in the right panel, but it still has avoidable work on each change (sync effects rebuilding nodes, heavy per-render helpers, expensive pointer-move updates).
- **UX is inconsistent and cognitively overloaded**: active profile selection and edit profile selection are split even though they represent the same user intent; operation editor UI is vertically long and dense; lots of technical fields are shown by default.
- **Tech debt / boundaries**: lots of inline styles; several `any` usages and forced remounting via `key` hacks (`depsKey`).

---

## Mapping to your reported problems

### 1) Drawer editor lags hard with 10+ operations
Primary reasons in current implementation:
- **Full list render**: `OperationProfileEditor` maps `fields` and renders `OperationItem` for every operation (no virtualization, no “edit selected only”).
- **Controlled-input explosion**: `FormInput`/`FormTextarea`/etc use `useController` → controlled value updates per keystroke. Multiply by dozens of fields × operations.
- **Autosize textarea cost**: many textareas use `autosize` which triggers layout/reflow on changes, multiplied by count.
- **Context/watch fan-out**:
  - `OperationDepsOptionsProvider` uses `useWatch({ name: 'operations' })` and publishes options via React context. Any change in any operation rebuilds options and updates the context value → all `dependsOn` consumers re-render.
- **Forced re-mount hacks (`depsKey`)**:
  - `depsKey` is incremented on many actions and used in `key=...` for form fields. This forces unmount/remount of heavy components (MultiSelect), resetting internal state and causing additional work and UX issues (focus jumps, scroll jumps).

### 2) Node editor is better, but panel/group/color sometimes lags
Likely reasons:
- The right panel uses `OperationItem` for **one selected op** → far fewer inputs rendered at once.
- Still has hot paths:
  - Node list is kept in sync with form using `setNodes(prev => ...)` with full-array mapping on changes.
  - Group drag (`moveGroupLabelDrag`) maps **all nodes** on each pointer move event.
  - Color parsing uses canvas-based normalization; currently invoked in render for the `<input type="color" value={...}>` via an IIFE, which recomputes on any state change.

### 3) “Active profile” vs “Edit profile” split is confusing
Current UI in `OperationProfilesSidebar` shows:
- Select #1: “Активный профиль (глобально)”
- Select #2: “Редактировать профиль”

This introduces two sources of truth in UX even if stores differ. The user’s mental model is: **I choose a profile → it becomes current; sometimes I set it active**. The current UI makes this look like two different “modes”.

### 4) Inputs lag even though they shouldn’t
This is consistent with:
- controlled RHF controllers for every field,
- parent/neighbor watchers firing,
- and heavy component trees per operation (Select/MultiSelect/Textareas).

### 5) Weird layout, poor UX
The per-operation UI is a single long Card with everything expanded by default:
- config toggles + hooks/triggers/order/dependsOn + template/params JSON + output/effects.
This is dense, non-scannable, and encourages “scroll fatigue”.

---

## Code-level findings (bad patterns / risky decisions)

### A) `OperationProfilesSidebar` (`index.tsx`)
- **Two selectors for essentially one intent**: selecting a profile and setting active profile are separated. This increases complexity and confusion.
- **Derived arrays created on every render**:
  - `profileOptions` is rebuilt each render. Not the biggest issue, but avoidable.
- **Side-effect helpers inside UI file**:
  - `downloadJson()` is inside the feature component file; better as shared util.
- **Unsafe import path**:
  - Import uses `doImportFx(parsed as any)` (type safety bypass).
- **No loading/error states for async**:
  - `loadProfiles()` / `loadSettings()` are fired on mount but UI has no “loading / failed” representation.

### B) Drawer form: `OperationProfileEditor` + `OperationItem`
- **Renders N operations in full detail**:
  - `fields.map(...) <OperationItem .../>` is the core scalability problem.
- **`depsKey` forced remount**:
  - Keys like `key={`${depsKey}-${index}-triggers`}` are an anti-pattern; they trade correctness for performance and usually worsen UX/perf.
  - Root cause is dependency options being recomputed/propagated poorly.
- **`useWatch` in many places**:
  - `OperationItem` uses `useWatch` for `opId` and `output`. Multiply watchers by operation count.
- **Mixing normalized “string unions” with `as any`**:
  - e.g. output is treated as `any` to keep “safeOutput”. This hides data-shape bugs.
- **Huge “god component” per operation**:
  - `OperationItem` includes config, template/params, output types, canonicalization, etc. This makes code hard to maintain and hard to optimize.

### C) Node editor modal: `node-editor/node-editor-modal.tsx` (currently: `operation-profile-node-editor-modal.tsx`)
Good:
- Tries to avoid ReactFlow loops by preserving measured props and skipping pointless updates.

Issues:
- **Multiple sources of truth**:
  - RHF `operations` is one state tree, ReactFlow `nodes` is another, plus separate `groups` state. Sync logic is heavy and brittle.
- **Expensive pointer-move updates**:
  - Group drag updates `nodes` by mapping the whole array on each `pointermove`.
  - This will get worse as node count grows.
- **Render-time heavy computation**:
  - Color `<input type="color">` uses an IIFE that calls `parseCssColorToRgb(...)` and does conversions on any render.
  - `parseCssColorToRgb` creates a canvas every call; this is expensive and GC-heavy.
- **Inline styles and inline `<style>` tag**:
  - Many inline objects are created each render; and style scoping is fragile.
- **`any` use**:
  - `computeBoundsFromNodes(nodes: any[])` and `(flow as any).screenToFlowPosition` bypass types and can mask bugs.

### D) `OperationDepsOptionsProvider` (`operation-deps-options.tsx`)
- **Context updates on every keystroke**:
  - Watches full `operations` array. Any field edit triggers provider recompute → context value changes → all consumers re-render.
- **This directly drives the need for `depsKey` hacks**:
  - When performance gets bad, devs reach for forced re-mount; the fix is to change data-flow.

### E) Shared form wrappers (`web/src/ui/form-components/*`)
This is a major performance footgun for large forms.

- **Everything is controlled**:
  - `FormInput` sets `value={field.value ?? ''}` and spreads `{...field}` from `useController`.
  - This makes typing cost scale with form complexity.
- **Error handling likely incorrect for nested names**:
  - Accessing `errors[name]` won’t work for dot-path names like `operations.0.name`.
  - Also, subscribing to `formState.errors` forces re-render when any error changes.
  - Prefer `fieldState.error` from `useController` for local subscription.

---

## Performance recommendations (prioritized)

### P0 (fast, highest impact)
- **Do not render all operations in the Drawer**:
  - Replace “full list of `OperationItem`” with:
    - a lightweight list (name, kind, enabled, required, dependsOn count), and
    - a single “selected operation editor” panel (like node editor does), OR
    - an accordion where only one item mounts at a time.
- **Stop using `depsKey` to force remount**:
  - Fix dependency options flow instead (see below).
- **Fix `form-components` to reduce controlled-input cost**:
  - For `TextInput`/`Textarea`, prefer `register` (uncontrolled) wrappers where possible.
  - Keep `Controller/useController` only for Mantine components that must be controlled (Select/MultiSelect/NumberInput if needed).
- **Make dependency options cheap and stable**:
  - Provide `dependsOn` options as a memoized list derived from `fields` (fieldArray) IDs + names, not from a broad `useWatch('operations')`.
  - Alternatively compute options once in parent and pass as props; avoid context updates for every keystroke.

### P1 (medium effort, unlock smooth UX)
- **Split `OperationItem` into subcomponents and lazy-mount heavy sections**:
  - Example sections:
    - “Basics” (name, kind, enabled/required)
    - “Execution” (hook, triggers, order, dependsOn)
    - “Template / Params” (large textarea/json)
    - “Output / Effects”
  - Mount “Template/Params” and “Output” only when expanded.
- **Throttle/RAF group drag updates in node editor**:
  - Accumulate pointer deltas and update nodes at most once per animation frame.
  - Update only nodes in the dragged group, not the entire list if possible (or at least avoid object recreation for nodes that don’t change).
- **Memoize/cached color parsing**:
  - Create a single canvas/context once (module-level singleton) or use a lightweight parser.
  - Avoid IIFEs in JSX for values; compute once with `useMemo` keyed by `groupEditor.bg`.

### P2 (structural improvements)
- **Unify state model for “current profile”**:
  - UI should have a single concept: “current profile”.
  - “Active globally” can be a flag/action on the same profile, not a separate primary selector.
- **Introduce virtualization for long lists** (if list view remains):
  - Use a virtual list for operation rows (not full editors).

---

## UI/UX recommendations

### Make “active profile” and “edit profile” one flow
Proposed UX:
- One selector: **Current profile**
  - shows label like `Name`
- Actions next to it:
  - “Save / Duplicate / Delete / Import / Export”

### Drawer layout: three-level information hierarchy
Current UI mixes “basic config” with “advanced runtime effects” at the same prominence.

Proposed hierarchy:
- **Profile header**: name, description, enabled, executionMode.
- **Operations list**: compact rows + search + filters (enabled/disabled, kind).
- **Editor panel**:
  - Tabs or collapses: Basics / Execution / Template&Params / Output.
  - Advanced sections collapsed by default.

### Operation editor: stop showing raw JSON by default
`paramsJson` textarea is explicitly marked as “черновой UI” — it should be:
- behind an “Advanced” toggle,
- or replaced with typed forms per `kind` gradually (even partial coverage helps).

---

## Naming recommendations

### In `index.tsx`
- `selectedId` → `editingProfileId`
- `$selectedOperationProfileId` → `$editingOperationProfileId`
- `selectOperationProfileForEdit` → `editingProfileSelected` (event) or `selectEditingProfile`
- `doSelect` → `selectEditingProfile`
- `settings` → `activeProfileSettings` or `operationProfileSettings`

### In operation editor
- `OperationProfileEditor` (Drawer) → `OperationProfileForm` (and split “view” vs “controller”)
- `OperationItem` → `OperationFormCard` (if it stays as a Card) or `OperationEditor`
- `depsKey` → remove; if needed, rename to `depsOptionsVersion` but the goal is to eliminate it.

### In node editor
- `groupEditor` → `groupEditorState`
- `safeOperations` → `operations` (after type-narrowing once)

---

## Recommended folder/module structure

Current folder is a mix of UI, form mapping, and node editor logic. Suggested structure:

```
web/src/features/sidebars/operation-profiles/
  index.tsx                       // entry (Drawer shell, profile picker)
  model/                          // (optional feature-local view model; domain stays in @model)
    selectors.ts                  // memoized selectors for UI (options, current profile)
  ui/
    profile-picker.tsx
    profile-actions.tsx
    operation-list.tsx            // lightweight, virtualizable list
    operation-row.tsx
    operation-editor/
      operation-editor.tsx        // edits one operation
      sections/
        basics-section.tsx
        execution-section.tsx
        output-section.tsx
      kind-sections/
        template-section.tsx
  node-editor/
    node-editor-modal.tsx
    flow/
      operation-flow-node.tsx
    meta/
      node-editor-meta.ts
    utils/
      color.ts                    // cached parser
      bounds.ts
      layout.ts
  form/
    operation-profile-form-mapping.ts  // to/from DTO (currently operation-profile-form.ts)
    types.ts
```

Key idea: make Drawer editor and Node editor share **the same “edit one operation” component** (or the same section components), instead of duplicating a huge editor.

---

## Concrete “next steps” plan (implementation order)

1) **Drawer: switch to “list + single editor”** (biggest UX/perf win).
2) **Remove `depsKey`** by changing how dependsOn options are computed and propagated (stable memoized list, passed as props).
3) **Refactor `@ui/form-components`**:
   - use `fieldState.error` instead of `formState.errors[name]`,
   - add uncontrolled wrappers for text inputs/textarea (register-based).
4) **Node editor: throttle group dragging + memoize color parsing**.
5) **UX polish**: unify profile selection/activation and reduce default visual noise.

---

## Work checklist (trackable)

> Use this checklist as a working plan. Check items as you complete them.

### Phase 0 — repo structure & naming (no behavior changes)

- [x] Create folder structure proposed in “Recommended folder/module structure”
  - [x] `web/src/features/sidebars/operation-profiles/ui/`
  - [x] `web/src/features/sidebars/operation-profiles/ui/operation-editor/sections/`
  - [x] `web/src/features/sidebars/operation-profiles/ui/operation-editor/kind-sections/`
  - [x] `web/src/features/sidebars/operation-profiles/node-editor/flow/`
  - [x] `web/src/features/sidebars/operation-profiles/node-editor/meta/`
  - [x] `web/src/features/sidebars/operation-profiles/node-editor/utils/`
  - [x] `web/src/features/sidebars/operation-profiles/form/`
- [x] Rename/move files to match naming recommendations (no logic changes; only path/exports/imports adjustments if needed)
  - [x] `operation-profile-form.ts` → `form/operation-profile-form-mapping.ts`
  - [x] `operation-profile-node-editor-meta.ts` → `node-editor/meta/node-editor-meta.ts`
  - [x] `operation-profile-flow-nodes.tsx` → `node-editor/flow/operation-flow-node.tsx`
  - [x] `operation-profile-node-editor-modal.tsx` → `node-editor/node-editor-modal.tsx` (if applicable)
- [x] Update imports to new paths and remove temporary compatibility re-exports
- [x] Introduce placeholder modules for planned extracts (empty exports or thin re-exports to keep moves incremental)
  - [x] `node-editor/utils/color.ts`
  - [x] `node-editor/utils/bounds.ts`
  - [x] `node-editor/utils/layout.ts`
  - [x] `ui/profile-picker.tsx`
  - [x] `ui/profile-actions.tsx`
  - [x] `ui/operation-list.tsx`
  - [x] `ui/operation-row.tsx`
  - [x] `ui/operation-editor/operation-editor.tsx`

### Phase 1 — P0 perf fixes (highest impact)

- [x] Drawer: replace “render all OperationItem” with “list + single editor” (or single-mounted accordion)
- [x] Remove `depsKey` remount hack
- [x] Make dependsOn options cheap & stable (avoid `useWatch('operations')` + context update on every keystroke)
- [x] Reduce controlled-input cost in large forms (prefer `register` for text inputs/textarea where possible)

Notes (Phase 1 implementation):
- Drawer now mounts **exactly one** `OperationEditor` at a time; the list is lightweight and uses per-row `useWatch`.
- `depsKey` and `OperationDepsOptionsProvider` were removed; dependsOn options are built by `useOperationDepsOptions()` and consumed only by the mounted editor.
- `@ui/form-components` now reads errors via `fieldState.error` (fixes dot-path fields and reduces error-driven re-renders).

### Phase 2 — P1 refactors for smoother UX

- [ ] Split `OperationItem` into sections; lazy-mount heavy parts (Template/Params, Output)
- [ ] Node editor: throttle/RAF group dragging; update only affected nodes
- [ ] Node editor: memoize/cached color parsing; avoid render-time IIFEs for derived values

### Phase 3 — P2 UX / model cleanup

- [ ] Unify “active profile” vs “edit profile” into one “current profile” flow
- [ ] Reduce default visual noise (collapse advanced sections; hide raw JSON behind Advanced)
- [ ] (If list stays long) add virtualization for operation rows

