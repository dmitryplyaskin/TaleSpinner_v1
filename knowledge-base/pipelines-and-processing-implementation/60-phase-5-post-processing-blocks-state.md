# Фаза 5 — `post`: канонизация результата, blocksJson и PipelineState

Цель: после завершения основной генерации привести результат к каноническому виду для UI/хранения и (опционально) обновить долговременное состояние через артефакты.

## Ссылки на спеку

- `post` семантика и ограничения write targets: `../pipelines-and-processing-spec/30-step-types.md`, `../pipelines-and-processing-spec/20-mutation-policy.md`
- Артефакты / state / версии: `../pipelines-and-processing-spec/40-artifacts.md`

## Что делаем

### F5.1 — Модель `post` как “после done”

В v1 рекомендация:

- `post` запускается **после** `llm.stream.done` (не стримим пост-обработку по дельтам)
- `post` может писать только в:
  - текущий assistant message/variant (format/safety/blocks),
  - `pipeline_artifacts` (если разрешено policy),
  - без изменений прошлых `chat_messages`.

### F5.2 — `blocksJson` на финале

Минимальный подход:

- стримим только текст ассистента (`promptText`)
- `blocksJson` создаётся/обновляется один раз в `post`

Отдельное правило:

- reasoning, если показываем, то только как `ui_only` (не должен попадать в `promptText`).

### F5.3 — PipelineState (`kind=state`) и optimistic concurrency

Обновление persisted state:

- шаг читает `art.<tag>.value` (и при необходимости `history`)
- вычисляет новую версию
- пишет с `basedOnVersion`
- mismatch → `artifact_conflict` (reject, без merge/auto-retry в v1)

### F5.4 — UI презентация latest_only vs timeline

Минимальные режимы:

- панели/state: `latest_only`
- ленты/feeds: `timeline` (с ограничением N)

## Критерии готовности

- `post` не ломает стрим и не создает гонок: все записи фиксируются после завершения генерации.
- `blocksJson` стабильно строится и соответствует выбранному “рендерному” контракту UI.
- Обновление state артефактов защищено `basedOnVersion` и даёт детерминированный результат.

