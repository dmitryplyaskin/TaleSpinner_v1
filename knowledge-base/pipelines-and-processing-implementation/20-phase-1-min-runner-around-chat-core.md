# Фаза 1 — Минимальный runner вокруг существующего chat-core

Цель: добиться того, чтобы **каждый turn** (user_message/regenerate) создавал наблюдаемый `PipelineRun` и линейные `PipelineStepRun` (`pre → llm → post`), при этом **не переписывая** текущую механику генерации/стрима.

## Ссылки на спеку

- Execution flow + идемпотентность: `../pipelines-and-processing-spec/10-execution-model.md`
- Step types (`llm` boundary): `../pipelines-and-processing-spec/30-step-types.md`
- SSE envelope + pipeline.* events: `../pipelines-and-processing-spec/60-sse-events.md`

## Что делаем

### F1.1 — Дедупликация/идемпотентность запуска

Правило v1:

- `user_message`: ключ дедупа = `(chatId, userMessageId)`
- `regenerate`: ключ дедупа = `(chatId, assistantVariantId)` (или иной стабильный идентификатор регенерации)
  - note: выбран вариант **client-sent `requestId`** → `pipeline_runs.idempotency_key = regenerate:<assistantMessageId>:<requestId>` + unique `(chat_id, idempotency_key)`

Поведение:

- повторный запрос с тем же ключом **не создаёт** новый run/generation, а возвращает уже существующие ids + текущий статус.
- автоматических ретраев нет; повтор — это новый `regenerate`.

### F1.2 — Линейные шаги и их статусы

Минимальная цепочка:

- `pre` (может быть no-op, но логируем факт старта/окончания)
- `llm` (привязан к существующей генерации chat-core)
- `post` (может быть no-op, но запускается после `done/aborted/error` генерации)

Важно:

- статусы должны быть согласованы: если `llm` aborted/error — `run` тоже aborted/error, `post` либо skipped, либо тоже завершён корректно (по выбранной модели).

### F1.3 — Корреляция ids и SSE envelope

Каждое SSE событие (кроме keep-alive) должно нести:

- `chatId`, `runId`
- `pipelineId`/`pipelineName` (на фазе 1 допускается “встроенный default pipeline”)
- `trigger`
- опционально: `stepRunId`, `stepType`
- опционально: `generationId`, `assistantMessageId`, `assistantVariantId`, `userMessageId`

Даже если UI пока не отображает эти поля, они критичны для будущего debug report.

### F1.4 — Финализация (done/aborted/error)

На завершении:

- закрыть `llm_generations.status`
- закрыть `pipeline_step_runs` по всем шагам
- закрыть `pipeline_runs.status` + `finishedAt`

### F1.5 — Abort

- единый `AbortSignal` (или эквивалент) на весь run
- `aborted` статус фиксируется одинаково в run/step/generation
- (если есть SSE прогресс) отправляем `pipeline.run.aborted`

## Критерии готовности

- Повторная отправка одного и того же запроса не создаёт дублей (проверяется по БД).
- Для каждого turn есть `PipelineRun` и 2–3 `PipelineStepRun` с корректными таймингами и статусами.
- SSE события содержат минимальный envelope для корреляции и дебага.
- Abort переводит всё в `aborted`, не оставляя “вечных running”.

