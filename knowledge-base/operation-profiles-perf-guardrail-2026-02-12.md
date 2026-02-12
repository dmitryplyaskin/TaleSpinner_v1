# Operation Profiles Performance Guardrail (2026-02-12)

## Goal
Manual dev-only profiling protocol for Operations Sidebar after perf refactor.

## Environment
- Build mode: production (`yarn build` + `yarn preview`) or optimized dev session.
- Browser: Chromium-based with React DevTools Profiler.
- Dataset sizes: 10, 25, 50 operations in one profile.

## Scenario A: prompt typing
1. Open `Operations` sidebar.
2. Select a profile with N operations.
3. Select an operation with kind `llm`.
4. Start Profiler recording.
5. Type 20-30 characters quickly in `prompt` field.
6. Stop recording.
7. Export profile as `ops-sidebar-prompt-N.json`.

## Scenario B: operation name typing
1. Same profile size N.
2. Start Profiler recording.
3. Type 20-30 characters quickly in operation `name`.
4. Stop recording.
5. Export profile as `ops-sidebar-name-N.json`.

## Acceptance thresholds
- N=25: p95 commit time < 16ms.
- N=50: p95 commit time < 24ms.
- No focus loss during typing.
- No cursor jumps.
- No editor unmount/remount flicker.
- No skipped frames during list scroll.

## Notes
- For list virtualization, ensure the list remains keyboard navigable (ArrowUp/ArrowDown/Enter).
- If p95 is above threshold only in dev mode, re-check with production build before regression decision.
