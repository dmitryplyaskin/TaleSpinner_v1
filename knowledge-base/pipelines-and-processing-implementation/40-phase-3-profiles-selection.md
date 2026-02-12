# Фаза 3 — PipelineProfile и резолв “активного профиля”

Цель: перейти от “встроенного default pipeline” к управляемой конфигурации: какие пайплайны активны и в каком порядке, с предсказуемым правилом наследования (global → entityProfile → chat).

## Ссылки на спеку

- Термины + приоритет резолва: `../pipelines-and-processing-spec/00-overview.md`
- Порядок пайплайнов и детерминизм: `../pipelines-and-processing-spec/10-execution-model.md`
- Открытые вопросы по selection: `../pipelines-and-processing-spec/90-open-questions.md`

## Что делаем

### F3.1 — Storage `PipelineProfile` + overrides

Минимум:

- Global default profile
- EntityProfile override
- Chat override

Правило приоритета (v1):

`chat override` → `entityProfile override` → `global default`

### F3.2 — `PipelineDefinition` (линейный контракт)

Для v1 достаточно:

- список шагов по порядку
- `stepType` (`pre|llm|post` в реализации v1)
- `paramsJson` (opaque)
- `enabledIf` (опционально; простые условия)

### F3.3 — Привязка `PipelineRun` к активному профилю

В каждую запись run-а:

- записываем `activePipelineProfileId` (и/или ревизию/версию)
- фиксируем “какой набор пайплайнов был включён” для воспроизводимости

### F3.4 — Минимальный UI для выбора профиля (web)

Минимум v1 UX:

- показать “какой профиль сейчас активен” в чате
- дать выбрать override для чата (с возможностью “inherit”)

Примечание (v1 реализация, минимальная):

- Управление профилями: `GET/POST/PUT/DELETE /api/pipeline-profiles`
- Установка active profile:
  - `GET /api/chats/:id/active-pipeline-profile`
  - `PUT /api/chats/:id/active-pipeline-profile` (chat override)
  - `PUT /api/entity-profiles/:id/active-pipeline-profile` (entity override)
  - `PUT /api/active-pipeline-profile` (global default)
- UI: в Drawer `Pipeline` — 3 селекта (chat/entity/global) + отображение resolved source.

## Критерии готовности

- Для любого chat можно детерминированно вычислить active profile.
- `PipelineRun` хранит ссылку на профиль, использованный при запуске.
- UI может менять chat override без ручного редактирования БД.

