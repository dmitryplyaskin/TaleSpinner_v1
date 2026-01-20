# Фаза 0 — Foundations: контракты данных и минимальная база под v1

Цель: подготовить “скелет” (типы/БД/API), чтобы дальше можно было безопасно внедрять runner и шаги без рефакторинга на каждом шаге.

## Ссылки на спеку

- Overview / инварианты: `../pipelines-and-processing-spec/00-overview.md`
- Execution model / идемпотентность: `../pipelines-and-processing-spec/10-execution-model.md`
- Observability / logging: `../pipelines-and-processing-spec/50-observability.md`, `../pipelines-and-processing-spec/55-logging-and-reproducibility.md`

## Что делаем

### F0.1 (shared) — типы/контракты

Минимальный набор доменных структур (без “лишнего”):

- `PipelineTrigger`: `user_message | regenerate | manual | api`
- `PipelineRunStatus`: `running | done | aborted | error`
- `PipelineStepType`: `pre | llm | post` (остальное зарезервировано на v2+)
- `PipelineStepStatus`: `running | done | aborted | error`
- `GenerationStatus`: `streaming | done | aborted | error`

Контракты:

- `PipelineRun` + корреляционные ids (chat/message/variant/generation)
- `PipelineStepRun` (input/output json с лимитами)
- `PromptDraft` (domain роли + content)

### F0.2 (db/server) — таблицы и индексы

Сверить текущие `pipeline_runs/pipeline_step_runs/llm_generations` со спекой и добавить недостающее:

- trigger/status/timings
- ссылки на active profile (id/версия) — даже если профили появятся позже, поле можно добавить заранее
- индексы под дедупликацию turn-а:
  - `(chatId, userMessageId)` для `user_message`
  - `(chatId, assistantVariantId)` для `regenerate`

### F0.3 (server) — read-only API “восстановления состояния”

Нужен для:

- восстановления UI после обрыва SSE (см. `60-sse-events.md`),
- debug report (будет в фазе 6),
- диагностики “почему не стримит”.

Минимум:

- получить текущий run/step/generation статусы по `chatId` и связанным ids.

### F0.4 (server) — ошибки и безопасные сообщения

Зафиксировать стабильные `error.code` (и mapping на HTTP), чтобы фронт мог показывать тосты без парсинга текста.

Минимум кодов (v1):

- `pipeline_policy_error`
- `pipeline_idempotency_conflict`
- `pipeline_generation_error`
- `pipeline_artifact_conflict` (зарезервировать под фазу 4)

## Критерии готовности (Definition of Done)

- Есть типы/enum’ы, которыми можно пользоваться в runner’е без “any/json blob”.
- БД содержит нужные поля/индексы и выдерживает повторный запрос (дедуп ключи готовы).
- Есть endpoint(ы) для чтения текущих статусов и связок ids по `chatId`.
- Ошибки имеют стабильные коды, не раскрывают чувствительные данные.

