# World Info v1: Session Handoff (2026-02-08)

## Что уже сделано

- Реализован backend-скелет и core-логика World Info:
  - DB schema + migration (`0015_world_info_v1.sql`);
  - репозитории, нормализация, matcher/groups/timed/scanner/runtime;
  - API `/api/world-info/*` (books/settings/bindings/import/export/resolve);
  - интеграция в generation pipeline (`wiBefore/wiAfter` в prompt);
  - `PromptSnapshotV1.meta.worldInfo`.
- Добавлены unit-тесты по ключевым WI модулям.
- Начат frontend UI через sidebar:
  - API client `web/src/api/world-info.ts`;
  - модель `web/src/model/world-info/index.ts`;
  - sidebar `web/src/features/sidebars/world-info/index.tsx`;
  - подключение кнопки/дровера в `left-bar` и `connect-sidebars`.

## Ключевые файлы

- План: `docs/world-info-implementation-plan-2026-02-08.md`
- API: `server/src/api/world-info.core.api.ts`
- DB:
  - `server/src/db/schema/world-info.ts`
  - `server/drizzle/0015_world_info_v1.sql`
- Runtime/services:
  - `server/src/services/world-info/world-info-runtime.ts`
  - `server/src/services/world-info/world-info-scanner.ts`
  - `server/src/services/world-info/world-info-repositories.ts`
  - `server/src/services/world-info/world-info-converters.ts`
- Prompt integration:
  - `server/src/services/chat-generation-v3/prompt/build-base-prompt.ts`
  - `server/src/services/chat-core/prompt-draft-builder.ts`
  - `server/src/services/chat-core/prompt-template-context.ts`

## Проверки (последний запуск)

- `yarn --cwd server typecheck` -> passed
- `yarn --cwd server test` -> passed
- `yarn --cwd server lint` -> passed без ошибок, но есть legacy warnings (import/order и др. вне WI).

## Что осталось

1. Integration tests API:
- проверить HTTP сценарии books/settings/bindings/resolve.

2. Integration tests prompt injection:
- e2e проверить `generate/regenerate` с фактическим попаданием `wiBefore/wiAfter` в llm messages.

3. API документация:
- [x] короткий README по `/api/world-info/*`:
  - `server/src/api/world-info.api.md`

4. Поздние этапы (из roadmap):
- `atDepth/outlet` инъекции в prompt draft;
- UI для World Info (начат MVP sidebar; нужен дальнейший polish и разбивка редактора на подкомпоненты);
- observability/метрики.

## Текущее состояние рабочего дерева

По `git status` есть незакоммиченные изменения в WI и смежных prompt-файлах.  
Перед продолжением рекомендуется:

1. Сделать отдельный commit текущего WI-среза.
2. Следующим commit’ом добавить integration tests (API + generation) и продолжить UI-полировку.

## Быстрый старт следующей сессии

1. Открыть:
- `docs/world-info-implementation-plan-2026-02-08.md`
- `server/src/api/world-info.core.api.ts`
- `server/src/services/world-info/world-info-runtime.ts`

2. Прогнать:
- `yarn --cwd server typecheck`
- `yarn --cwd server test`

3. Продолжить с integration tests (API + generation) и расширения World Info sidebar.
