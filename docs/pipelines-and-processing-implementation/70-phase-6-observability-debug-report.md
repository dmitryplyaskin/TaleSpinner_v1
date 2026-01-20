# Фаза 6 — Observability: SSE прогресс и “Debug report”

Цель: сделать пайплайны **объяснимыми** для пользователя и удобными для отладки: видно “что выполняется”, можно восстановить состояние после обрыва SSE, и можно открыть отчёт “почему получился такой ответ”.

## Ссылки на спеку

- Observability минимум: `../pipelines-and-processing-spec/50-observability.md`
- Logging & reproducibility (debug report, redaction, promptHash): `../pipelines-and-processing-spec/55-logging-and-reproducibility.md`
- SSE события прогресса: `../pipelines-and-processing-spec/60-sse-events.md`

## Что делаем

### F6.1 — `pipeline.run.*` и (опционально) `pipeline.step.*`

Минимум:

- `pipeline.run.started`
- `pipeline.run.done`
- `pipeline.run.aborted`
- `pipeline.run.error`

Опционально v1 (если UX требует):

- `pipeline.step.started`
- `pipeline.step.done`

### F6.2 — UI прогресс и восстановление после обрыва SSE

UI должен уметь:

- показать “Pipeline выполняется” (с именем/шагом)
- если SSE оборвался — перечитать статусы через API и восстановить индикатор

### F6.3 — User-facing Debug report

Минимальный состав (по спеке):

- почему запустилось (trigger + ключ дедупликации)
- вход: user message (selected variant) + каноническая history (`promptText`)
- effective prompt: `PromptDraft.messages[]` (redacted) + сведения о trimming
- какие пайплайны/шаги выполнялись + тайминги/статусы
- какие `art.<tag>` читали/включали и какие обновили (old/new, basedOnVersion, краткий diff/summary)
- параметры генерации (provider/model/paramsJson) + usage, если есть
- отметки приватности (reasoning не хранится сырьём)

### F6.4 — Лимиты и retention логов

Фиксируем bounded-size правила:

- truncate/omit больших полей в `pipeline_step_runs.inputJson/outputJson`
- `promptSnapshotJson` — только redacted и с лимитом
- большие артефакты в отчёте — через ссылки + summary, без полного дампа

## Критерии готовности

- Пользователь видит “что происходит” во время генерации и не думает, что всё зависло.
- После обрыва SSE UI корректно восстанавливает состояние.
- Debug report объясняет “A,B,C → X” без хранения чувствительных данных и без неограниченного роста логов.

