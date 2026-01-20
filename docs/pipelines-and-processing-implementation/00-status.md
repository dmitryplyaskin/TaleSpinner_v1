# Статус реализации: Pipelines + Pre/Post Processing (v1)

Источник требований: `docs/pipelines-and-processing-spec/map.md` (спека v0.1).

## Легенда

- `- [ ]` — не начато
- `- [x]` — сделано
- Доп. пометки в конце строки:
  - `(**in progress**)`
  - `(**blocked: ...**)`

## Ключевые инварианты (v1)

- Backend — **source of truth**: процесс и итоговый effective prompt реконструируются с сервера/БД.
- `llm` — **граница существующего chat-core**: в v1 не переписываем стрим/flush; добавляем `pre` до и `post` после.
- По умолчанию **не переписываем прошлую историю**; допускаем prompt-time мутации и каноническую запись результата текущего хода.
- Композиция влияний нескольких пайплайнов на effective prompt в v1 — **через артефакты** (`PipelineArtifact` + `promptInclusion`).

## Фазы (от простого к сложному)

- Фаза 0: `10-phase-0-foundations.md`
- Фаза 1: `20-phase-1-min-runner-around-chat-core.md`
- Фаза 2: `30-phase-2-pre-step-prompt-draft.md`
- Фаза 3: `40-phase-3-profiles-selection.md`
- Фаза 4: `50-phase-4-artifacts-session-view.md`
- Фаза 5: `60-phase-5-post-processing-blocks-state.md`
- Фаза 6: `70-phase-6-observability-debug-report.md`
- Backlog v2+: `90-backlog-v2-plus.md`

---

## Фаза 0 — Foundations (контракты данных + минимальные миграции)

- [ ] **F0.1 (shared)**: Ввести/уточнить типы: `PipelineRun`, `PipelineStepRun`, `Generation`, `PromptDraft`, базовые enum статусов/триггеров.
- [ ] **F0.2 (db/server)**: Аудит текущих таблиц `pipeline_runs`, `pipeline_step_runs`, `llm_generations`: сопоставить со спекой и добавить недостающие поля (trigger/status/timings/correlation ids), индексы под дедупликацию.
- [ ] **F0.3 (server)**: Минимальный read-only API для UI: получить состояние “текущий run/step/generation” по `chatId` + связанным ids (для восстановления после обрыва SSE).
- [ ] **F0.4 (server)**: Единый enum ошибок для pipeline (`policy_error`, `artifact_conflict`, `idempotency_conflict`, …) и безопасные сообщения.

## Фаза 1 — Минимальный runner вокруг существующего chat-core

- [ ] **F1.1 (server)**: Создание `PipelineRun` на `user_message` и `regenerate` с дедупликацией ключа:
  - `(chatId, userMessageId)` для `user_message`
  - `(chatId, assistantVariantId)` (или стабильный id regenerate) для `regenerate`
- [ ] **F1.2 (server)**: Запись `pipeline_step_runs` для линейной цепочки `pre → llm → post` (пока `pre/post` могут быть no-op).
- [ ] **F1.3 (server)**: Протянуть корреляцию ids во все записи и SSE envelope (см. `docs/pipelines-and-processing-spec/60-sse-events.md`).
- [ ] **F1.4 (server)**: Корректная финализация статусов `pipeline_runs/pipeline_step_runs/llm_generations` на `done/aborted/error`.
- [ ] **F1.5 (server)**: Abort: единый `AbortSignal` на run/step, корректные статусы и `pipeline.run.aborted`.

## Фаза 2 — `pre` шаг: сборка `PromptDraft` (без артефактов v1-минимум)

- [ ] **F2.1 (server)**: Представление `PromptDraft.messages[]` (domain роли) + маппинг `developer → system` (v1 правило).
- [ ] **F2.2 (server)**: Сборка effective prompt из:
  - system prompt (шаблон/инструкции/политика),
  - history как `promptText` выбранных вариантов,
  - prompt-time trimming (логируем решения, не “полотна”).
- [ ] **F2.3 (server)**: (Опционально v1) `message_transform` только для **текущего** `userMessageId` через variants, под контролем policy.
- [ ] **F2.4 (server)**: Redacted `promptSnapshotJson` + `promptHash` (см. `55-logging-and-reproducibility.md`).

## Фаза 3 — PipelineProfile + резолв активного профиля (пока без артефактных коллизий)

- [ ] **F3.1 (db/server)**: Хранение `PipelineProfile` (global default / entityProfile override / chat override) + правило приоритета резолва.
- [ ] **F3.2 (server)**: Контракт `PipelineDefinition` (линейный список шагов + условия включения).
- [ ] **F3.3 (server)**: Привязать `PipelineRun` к “активному профилю” (id/версия) для отладки и воспроизводимости.
- [ ] **F3.4 (web)**: Минимальный UI/настройка выбора профиля на уровне чата (read/write).

## Фаза 4 — Артефакты: `pipeline_artifacts`, SessionView и `art.<tag>`

- [ ] **F4.1 (db/server)**: Ввести `pipeline_artifacts` по модели **Latest + History** (версионирование, retention политика per-tag).
- [ ] **F4.2 (server)**: `SessionView` для чата (v1 chat-scoped), доступ в Liquid как `art.<tag>.value` и `art.<tag>.history[]`.
- [ ] **F4.3 (server)**: Runtime-guard `single-writer per persisted tag` + валидация коллизий тегов при активации профиля.
- [ ] **F4.4 (server)**: `promptInclusion` (минимум v1): `append_after_last_user`, `prepend_system`, `as_message` + детерминированный ordering (profile order → step order → tag → version).
- [ ] **F4.5 (web)**: Базовый рендер артефактов по `uiSurface` (минимум: `panel:*` и `feed:*` как отдельные виджеты/ленты).

## Фаза 5 — `post` шаг: канонизация ответа, blocks, state

- [ ] **F5.1 (server)**: `post` выполняется после `llm.stream.done` и может обновлять только write targets текущего хода + артефакты (по policy).
- [ ] **F5.2 (server)**: Генерация/нормализация `blocksJson` на финале (v1 рекомендация) + правило “reasoning в UI-only”.
- [ ] **F5.3 (server)**: `PipelineState` как `kind=state` артефакт (json), обновление с `basedOnVersion` и reject при конфликте.
- [ ] **F5.4 (web)**: UI для “latest_only” панелей (state) и “timeline” лент (feed) согласно `uiPresentation`.

## Фаза 6 — Observability + debug report (пользовательская объяснимость)

- [ ] **F6.1 (server)**: SSE события прогресса: `pipeline.run.*` и (опционально v1) `pipeline.step.*`.
- [ ] **F6.2 (web)**: UI индикатор “что происходит” (run/step) + восстановление состояния через API при обрыве SSE.
- [ ] **F6.3 (server/web)**: “Debug report” экран: входы (ids + selected variants), effective prompt (redacted), trimming summary, артефакты (read/write), параметры генерации, приватность.
- [ ] **F6.4 (server)**: Лимиты/retention логов: truncate/omit больших полей в `inputJson/outputJson` и `promptSnapshotJson`.

---

## Гейты / вопросы, которые надо закрыть перед реализацией спорных частей

- [ ] **Q1**: Нужны ли `pipeline.step.*` события уже в v1 (или достаточно `pipeline.run.*`) — см. `docs/pipelines-and-processing-spec/90-open-questions.md`.
- [ ] **Q2**: Обязателен ли `promptSnapshotJson` в v1 (redacted) или достаточно step-логов + `promptHash`.
- [ ] **Q3**: Где именно храним активный `PipelineProfile` (chat/entity/global) и какие UX-потоки нужны в web.

