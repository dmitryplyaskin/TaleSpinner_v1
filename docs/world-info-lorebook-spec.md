# SillyTavern World Info / Lorebook Spec (Parity-Oriented)

This document specifies how SillyTavern world info (lorebooks) works in current code, with focus on behavior-level parity.

Scope:
- Data contracts and storage
- Activation/scanning algorithm
- Prompt assembly and injection
- UI behavior
- API contracts
- Import/export and conversion paths
- Events and extension hooks

Primary code references:
- `public/scripts/world-info.js`
- `public/script.js`
- `public/index.html`
- `public/css/world-info.css`
- `src/endpoints/worldinfo.js`
- `src/endpoints/settings.js`
- `src/endpoints/characters.js`
- `public/scripts/macros.js`
- `public/scripts/constants.js`
- `public/scripts/events.js`
- `public/scripts/extensions/vectors/index.js`

## 1) Terminology

- Lorebook and World Info are the same concept in ST.
- A world is a lorebook file (`<name>.json`) in user worlds directory.
- Entry is one record in `world.entries`.
- Scan means matching keys against current context to activate entries.

## 2) Persistence and Sources

World files:
- Path: `data/<user>/worlds/<worldName>.json`
- Backend route family: `/api/worldinfo/*`

Global lorebook selection:
- Stored in settings under `world_info_settings.world_info.globalSelect` (legacy migrations supported).
- Runtime list: `selected_world_info`.

Character-bound lorebooks:
- Primary: `characters[chid].data.extensions.world`
- Additional: `world_info.charLore[]` as `{ name: <charFileName>, extraBooks: string[] }`

Chat-bound lorebook:
- `chat_metadata.world_info`

Persona-bound lorebook:
- `power_user.persona_description_lorebook`

Timed effects persistence:
- `chat_metadata.timedWorldInfo.sticky` and `.cooldown`

## 3) Core Enums and Constants

Insertion strategy (`world_info_character_strategy`):
- `0`: evenly
- `1`: character first
- `2`: global first

Secondary logic (`selectiveLogic`):
- `0`: AND_ANY
- `1`: NOT_ALL
- `2`: NOT_ANY
- `3`: AND_ALL

Scan states:
- `0`: NONE
- `1`: INITIAL
- `2`: RECURSION
- `3`: MIN_ACTIVATIONS

Entry position (`position`):
- `0`: before
- `1`: after
- `2`: ANTop
- `3`: ANBottom
- `4`: atDepth
- `5`: EMTop
- `6`: EMBottom
- `7`: outlet

At-depth role:
- `0`: SYSTEM
- `1`: USER
- `2`: ASSISTANT

Generation trigger values:
- `normal`, `continue`, `impersonate`, `swipe`, `regenerate`, `quiet`

## 4) Global Settings Contract

Returned by `getWorldInfoSettings()`:
- `world_info` (object; includes extras like `globalSelect`, `charLore`)
- `world_info_depth` default `2`
- `world_info_min_activations` default `0`
- `world_info_min_activations_depth_max` default `0`
- `world_info_budget` default `25` (percent of max context)
- `world_info_include_names` default `true`
- `world_info_recursive` default `false`
- `world_info_overflow_alert` default `false`
- `world_info_case_sensitive` default `false`
- `world_info_match_whole_words` default `false`
- `world_info_use_group_scoring` default `false`
- `world_info_character_strategy` default `1`
- `world_info_budget_cap` default `0` (disabled)
- `world_info_max_recursion_steps` default `0` (disabled)

Migration behavior:
- Legacy `settings.world_info` string/array migrated to `selected_world_info`.
- If `world_info_budget > 100`, reset to `25`.

## 5) Entry Data Contract

Default template (`newWorldInfoEntryTemplate`):
- `key: string[]` default `[]`
- `keysecondary: string[]` default `[]`
- `comment: string` default `''`
- `content: string` default `''`
- `constant: boolean` default `false`
- `vectorized: boolean` default `false`
- `selective: boolean` default `true`
- `selectiveLogic: number` default `0`
- `addMemo: boolean` default `false`
- `order: number` default `100`
- `position: number` default `0`
- `disable: boolean` default `false`
- `ignoreBudget: boolean` default `false`
- `excludeRecursion: boolean` default `false`
- `preventRecursion: boolean` default `false`
- `matchPersonaDescription: boolean` default `false`
- `matchCharacterDescription: boolean` default `false`
- `matchCharacterPersonality: boolean` default `false`
- `matchCharacterDepthPrompt: boolean` default `false`
- `matchScenario: boolean` default `false`
- `matchCreatorNotes: boolean` default `false`
- `delayUntilRecursion: number` default `0` (runtime also supports boolean)
- `probability: number` default `100`
- `useProbability: boolean` default `true`
- `depth: number` default `4`
- `outletName: string` default `''`
- `group: string` default `''` (comma-separated groups supported)
- `groupOverride: boolean` default `false`
- `groupWeight: number` default `100`
- `scanDepth: number|null` default `null`
- `caseSensitive: boolean|null` default `null` (inherit global)
- `matchWholeWords: boolean|null` default `null` (inherit global)
- `useGroupScoring: boolean|null` default `null` (inherit global)
- `automationId: string` default `''`
- `role: number` default `0`
- `sticky: number|null` default `null`
- `cooldown: number|null` default `null`
- `delay: number|null` default `null`
- `triggers: string[]` default `[]` (must be known generation triggers)

Runtime-added/required fields:
- `uid: number`
- `world: string` (added during source loading, not necessarily persisted)
- `displayIndex` used for custom sorting
- `extensions` may exist and is preserved
- `characterFilter` optional object:
  - `isExclude: boolean`
  - `names: string[]`
  - `tags: string[]`

Normalization on editor load (`addMissingWorldInfoFields`):
- Missing template fields are backfilled.
- `key` and `keysecondary` forced to arrays.
- Invalid/missing `characterFilter` coerced to object shape above.

## 6) Backend API Contract

### POST `/api/worldinfo/get`
Request:
- `{ "name": "<worldName>" }`
Response:
- Parsed world JSON
- If file missing, backend returns dummy `{ entries: {} }` (not 404)

### POST `/api/worldinfo/edit`
Request:
- `{ "name": "<worldName>", "data": { ...must contain entries... } }`
Validation:
- `name` required
- `data.entries` required
Side effect:
- Writes prettified JSON to `<worldName>.json`

### POST `/api/worldinfo/delete`
Request:
- `{ "name": "<worldName>" }`
Side effect:
- Deletes file

### POST `/api/worldinfo/import`
Request:
- multipart with `avatar` file
- optional `convertedData` string (used instead of uploaded file contents)
Validation:
- Parsed JSON must contain `entries`
Side effect:
- Saves as sanitized original filename stem + `.json`

### POST `/api/worldinfo/list`
Returns for each world file:
- `file_id` (filename stem)
- `name` (top-level `name` if present, else file stem)
- `extensions` (top-level `extensions` object if present)

### POST `/api/settings/get`
Used by frontend to refresh world names list:
- Returns `world_names` from worlds directory `.json` files sorted lexicographically.

## 7) Source Aggregation Rules

`getSortedEntries()` loads entries from:
- Global selected worlds
- Character primary + additional worlds
- Chat world
- Persona world

Dedup/skips by world source:
- Character worlds skipped if same world already active globally/chat/persona.
- Chat world skipped if already global.
- Persona world skipped if same as chat or already global.

Ordering:
- Chat lore always first.
- Persona lore always second.
- Global and character lore order depends on insertion strategy:
  - evenly: merged then sorted by `order` desc
  - character first: character(desc) then global(desc)
  - global first: global(desc) then character(desc)

Post-processing:
- Parse decorators from entry content.
- Replace `content` with decorator-stripped content.
- Add `hash = getStringHash(JSON.stringify(entry))`.
- Return deep clone.

## 8) Decorator Rules

Known decorators at top of content:
- `@@activate`
- `@@dont_activate`

Behavior:
- Only leading consecutive decorator lines are parsed.
- `@@activate` forces activation.
- `@@dont_activate` forces suppression.
- `@@@...` escapes decorator syntax for that line (one `@` removed when recognized).

## 9) Matching Rules

Input scan text:
- Built from latest chat messages (caller passes chat in reverse order: newest first).
- Base depth = `world_info_depth`, can be overridden per entry by `scanDepth`.
- Can include additional global sources if entry flags enabled:
  - persona description
  - character description
  - character personality
  - character depth prompt
  - scenario
  - creator notes
- Includes extension prompts marked `scan: true`.
- Includes recursion buffer except in MIN_ACTIVATIONS state.

Key matching:
- Primary keys are required (`entry.key` must be non-empty).
- Macro substitution applied to each key before matching.
- Regex keys supported via slash format: `/pattern/flags`.
- Regex parser requires unescaped delimiter slashes to be balanced.
- If key is not regex:
  - case handling via entry override or global setting
  - whole-word behavior via entry override or global setting
  - single-word whole-word uses boundary regex `(?:^|\W)(key)(?:$|\W)`
  - multi-word whole-word still uses substring include

Secondary logic:
- Empty `keysecondary` means primary match is sufficient.
- With secondary keys:
  - AND_ANY: at least one secondary must match
  - AND_ALL: all secondary must match
  - NOT_ALL: at least one secondary must fail
  - NOT_ANY: none of secondary must match

## 10) Scan Algorithm (Parity Behavior)

Budget:
- `budget = round(world_info_budget * maxContext / 100) || 1`
- If `world_info_budget_cap > 0`, clamp to cap.

Loop flow:
1. Initialize `scanState = INITIAL`.
2. For each loop:
3. Stop if `world_info_max_recursion_steps > 0` and loop count reached.
4. Evaluate each entry in sorted order (with many suppressors).
5. Collect `activatedNow`.
6. Sort `activatedNow` sticky-first, then original sorted order.
7. Apply inclusion-group filtering.
8. Apply probability and budget admission.
9. Add accepted entries to `allActivatedEntries` map keyed by `world.uid`.
10. Compute next scan state (recursion, min-activations, delayed recursion levels).
11. Emit `WORLDINFO_SCAN_DONE` with mutable args.
12. Continue until `scanState = NONE`.

Entry suppressor/activation order (as coded):
- Skip if already failed probability in prior loop.
- Skip if already activated.
- Skip if disabled.
- Skip if generation trigger filter does not include current trigger.
- Skip if character name/tag filters exclude current character.
- Skip by timed delay.
- Skip by cooldown if not sticky.
- Skip by `delayUntilRecursion` when not in recursion and not sticky.
- In recursion state, skip if delay level not yet reached.
- In recursion state, skip if `excludeRecursion` and not sticky.
- Decorator `@@activate` activates.
- Decorator `@@dont_activate` suppresses.
- External activation (`WORLDINFO_FORCE_ACTIVATE`) activates.
- `constant` activates.
- Active sticky activates.
- No primary keys -> skip.
- Else key matching logic applies.

Probability:
- If `useProbability` false or `probability == 100`, pass.
- Sticky entries do not reroll probability.
- On fail, entry is blacklisted for all later loops in this scan.

Budget admission:
- Content is macro-substituted before counting.
- Entries with `ignoreBudget` can still pass after overflow.
- Non-ignore entries are skipped after overflow.

Recursion/min-activation transitions:
- Recursion if recursive enabled and there are successful entries that are not `preventRecursion`.
- If in MIN_ACTIVATIONS and recurse buffer exists, force one recursion pass before further depth expansion.
- Min activations:
  - If total activated < `world_info_min_activations`, increase scan depth by 1 and rescan as MIN_ACTIVATIONS
  - Stop when `world_info_min_activations_depth_max` exceeded (if >0) or depth exceeds chat length
- Delayed recursion levels:
  - `delayUntilRecursion=true` treated as level 1
  - Numeric values create staged recursion level gates

## 11) Inclusion Group Rules

Grouping:
- `group` can contain multiple comma-separated group names.
- Entry participates in each named group.

Timed effect filter in groups:
- If group has sticky entries, non-sticky members are removed.
- Cooldown/delay members are removed.

Group scoring:
- Enabled if global `world_info_use_group_scoring` true or any entry has `useGroupScoring=true`.
- For scored entries only:
  - Compute score from matched primary/secondary rules via `buffer.getScore`.
  - Remove scored entries below group max score.

Winner selection:
- If group already activated in prior loops (`x.group === groupName` exact string check), remove new contenders.
- If any `groupOverride=true`, highest `order` among overrides wins.
- Otherwise weighted random by `groupWeight` (default 100).

## 12) Timed Effects Rules

Supported effects:
- `sticky`: remain active for N messages after activation
- `cooldown`: cannot activate for N messages after activation
- `delay`: cannot activate until chat has at least N messages

Stored metadata shape:
- `{ hash, start, end, protected }`

Lifecycle:
- On scan start, active sticky/cooldown loaded from `chat_metadata.timedWorldInfo`.
- If chat did not advance and effect not protected, effect is removed.
- Sticky expiration callback auto-applies cooldown immediately (protected=true) if configured.
- On scan end, activated entries get sticky and cooldown entries created if configured.
- Dry run:
  - sticky/cooldown state not read/written
  - delay still evaluated

`0` or falsy numeric effect values behave as disabled because checks use truthiness.

## 13) Prompt Assembly Contract

After scan, entries are transformed and split by `position`.

Content transform:
- `getRegexedString(entry.content, WORLD_INFO, { depth: entry.depth if atDepth })`
- Empty result means entry omitted.

Output channels:
- `worldInfoBefore`: joined newline block for `position=before`
- `worldInfoAfter`: joined newline block for `position=after`
- `EMEntries`: array of `{ position: before|after, content }` from `EMTop/EMBottom`
- `ANBeforeEntries`: array from `ANTop`
- `ANAfterEntries`: array from `ANBottom`
- `WIDepthEntries`: grouped by `(depth, role)` for `position=atDepth`
- `outletEntries`: map `outletName -> string[]` for `position=outlet`

Author's Note integration:
- If `shouldWIAddPrompt` is true, Author's Note is rewritten as:
  - `ANTop + originalAN + ANBottom`

At generation integration (`public/script.js`):
- `worldInfoBefore/After` used in story-string params as both `wiBefore/wiAfter` and `loreBefore/loreAfter`.
- `worldInfoExamples` injected into message examples before/after anchors.
- `WIDepthEntries` injected as extension prompts at in-chat depth with role.
- `outletEntries` exposed via macro `{{outlet::<key>}}` through extension prompt storage.

OpenAI/Chat Completions path:
- `worldInfoBefore` and `worldInfoAfter` are inserted as dedicated system prompts.
- Formatting wrapper can apply (`oai_settings.wi_format`).

Cleanup:
- WI depth/outlet injections are flushed each generation cycle via prefix delete:
  - `customDepthWI*`
  - `customWIOutlet_*`

## 14) UI Specification

Global World panel controls:
- Active World(s) multiselect (`#world_info`)
- Scan Depth slider/input
- Context % slider/input
- Budget Cap slider/input
- Min Activations slider/input
- Min Activation Max Depth slider/input
- Max Recursion Steps slider/input
- Insertion Strategy select
- Include Names checkbox
- Recursive Scan checkbox
- Case-sensitive checkbox
- Match Whole Words checkbox
- Use Group Scoring checkbox
- Alert On Overflow checkbox

Mutual exclusion in UI:
- Setting Min Activations non-zero auto-resets Max Recursion Steps to 0.
- Setting Max Recursion Steps non-zero auto-resets Min Activations to 0.

World editor toolbar:
- New world
- Import world
- Export world
- Rename world
- Duplicate world
- Delete world
- New entry
- Open all / Close all entry drawers
- Backfill empty memo/title from keys
- Apply current sorting into `order`
- Search
- Sort dropdown
- Refresh
- Pagination and page-size selector

Entry header fields:
- Comment/title textarea
- State selector: constant/normal/vectorized
- Position select
- Depth
- Order
- Trigger %
- Enable/disable toggle
- Move/copy
- Duplicate
- Delete

Entry drawer fields:
- Primary keywords
- Secondary keywords
- Logic type
- Content
- Outlet name
- Scan depth override
- Case-sensitive override
- Whole-word override
- Group scoring override
- Automation ID
- Recursion level
- Exclude recursion
- Prevent further recursion
- Delay until recursion
- Ignore budget
- Group
- Group override (prioritize)
- Group weight
- Sticky/Cooldown/Delay
- Character/tag filters (+exclude mode)
- Generation trigger filters
- Additional matching sources (persona/description/personality/depth/scenario/creator notes)

Conditional UI visibility:
- `delayUntilRecursionLevel` shown only if `delay_until_recursion` checked.
- `outletName` shown only if position is Outlet.

Search behavior:
- Fuzzy search across key, group, comment, keysecondary, content, uid, automationId.
- When search active, temporary sort mode "Search" appears and scores drive ordering.

Custom ordering:
- Drag-and-drop enabled in editor list.
- Persisted via `displayIndex`.

## 15) Binding UX Contracts

Chat lorebook button:
- Opens selector popup for chat-bound world.
- Alt+click with bound world opens editor directly.

Persona lorebook button:
- Opens selector popup for persona-bound world.
- Alt+click with bound world opens editor directly.

Character world:
- Popup includes primary lorebook and additional lorebooks.
- Additional lorebooks are settings-only (not exported with character).

Embedded character lorebook:
- If character has embedded `character_book`, UI can prompt import.
- Import creates/overwrites world file and links it as primary character world.

## 16) Import/Export and Conversion

Supported import sources:
- Native ST world json (`entries` object)
- PNG with embedded JSON (`naidata`)
- Novel lorebook format (`lorebookVersion`)
- Agnai memory (`kind === "memory"`)
- Risu lorebook (`type === "risu"`)

Converters map to ST entry schema and fill defaults.

Character book conversion (`convertCharacterBook`):
- Converts `character_book.entries[]` into ST world entries.
- Preserves original source as `data.originalData`.
- Maps extension fields (`extensions.position`, recursion flags, depth, probability, group, role, timed effects, triggers, ignore_budget, etc.).

Server-side export embedding (`convertWorldInfoToCharacterBook`):
- On character export/import path, world entries mapped back into v2 character book shape.
- Includes extension fields in snake_case under `extensions`.

## 17) Event and Hook Contracts

Emitted:
- `WORLDINFO_ENTRIES_LOADED`: after loading source arrays
- `WORLDINFO_SCAN_DONE`: after each scan loop, with mutable args object
- `WORLD_INFO_ACTIVATED`: final activated entries array (non-dry-run)
- `WORLDINFO_SETTINGS_UPDATED`: whenever WI settings changed
- `WORLDINFO_UPDATED`: when world file saved

Consumed:
- `WORLDINFO_FORCE_ACTIVATE`: external entry force-activation hook
  - Required fields per entry: `world`, `uid`

Notable integrations:
- Vectors extension emits `WORLDINFO_FORCE_ACTIVATE`.
- Quick Reply auto-exec listens `WORLD_INFO_ACTIVATED` and matches `automationId`.

## 18) Compatibility Notes (As-Implemented Quirks)

- Group "already activated" check compares exact `entry.group === groupName`, not split membership.
- Prompt assembly uses `sort(order desc)` then `unshift`, so final ordering reflects current code behavior.
- `sticky/cooldown/delay = 0` behaves as disabled because checks are truthy/falsy.
- If no sorted entries exist, function returns early (external activation map reset is not reached in that path).
- `/api/worldinfo/get` for missing file returns dummy object instead of error.

## 19) Parity Test Checklist

Use this for black-box parity against ST behavior:

1. Source precedence
- Configure same world in global + chat + persona + character and verify dedup/priority ordering.

2. Matching matrix
- Validate primary + each selective logic mode with and without secondary keys.
- Validate regex keys, case sensitivity, whole-word mode.

3. Recursion matrix
- Recursive on/off.
- `excludeRecursion`, `preventRecursion`, `delayUntilRecursion=true`.
- Numeric delay levels (`delayUntilRecursion=1,2,3`).

4. Min activation and depth skew
- Set min activations with max depth cap and confirm depth increments.

5. Budget behavior
- Verify percent budget, cap, overflow handling, ignoreBudget entries after overflow.

6. Inclusion groups
- Weighted selection, groupOverride, group scoring on/off, per-entry scoring override.

7. Timed effects
- sticky, cooldown, delay.
- Swipe/delete/no-advance behavior.
- sticky-to-cooldown transition on sticky end.

8. Prompt channel outputs
- Before/after blocks, AN top/bottom, EM top/bottom, at-depth by role, outlets.
- Macro `{{outlet::key}}` replacement.

9. UI parity
- Control defaults, conditional fields, drag custom order, search-sort mode appearance.

10. API parity
- Save/get/delete/import routes and minimal validation behavior.

