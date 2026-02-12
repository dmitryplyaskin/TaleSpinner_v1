# Фаза 2 — `pre`: сборка PromptDraft (v1 без артефактов)

Цель: сделать `pre` шаг “реальным”: он формирует **effective prompt** (PromptDraft), логирует принятые решения (template/trimming/policy), и (опционально) умеет нормализовать текущий user input через variants.

## Ссылки на спеку

- `pre` семантика + `message_transform`: `../pipelines-and-processing-spec/30-step-types.md`
- Promptable truth (`promptText`) и инварианты: `../pipelines-and-processing-spec/00-overview.md`
- Logging / promptSnapshot / promptHash: `../pipelines-and-processing-spec/55-logging-and-reproducibility.md`

## Что делаем

## UI гейт (v1, чтобы Ф2 была проверяемой)

Без минимального UI мы не сможем ни проверить состав effective prompt, ни отлаживать trimming/шаблон.

Минимум v1 (dev/debug):

- В web Drawer `Pipeline`:
  - показывать `resolved active profile` (источник: chat/entity/global),
  - показывать `promptHash` и `promptSnapshotJson (redacted)` для последнего run-а текущего чата.
- Endpoints:
  - `GET /api/chats/:id/pipeline-debug?branchId=<id>` — вернуть `run/steps/generation` + `promptHash/promptSnapshotJson`

### F2.1 — `PromptDraft.messages[]` и роли

Вводим доменные роли:

- `system | developer | user | assistant`

v1 правило:

- `developer → system` (при отправке провайдеру), но в debug report показываем исходную доменную роль.

### F2.2 — Сборка effective prompt

Собираем PromptDraft из:

- system prompt: инструкции/шаблон (Liquid) + policy composition,
- history: **строго `promptText` выбранных variants**,
- trimming: лимиты по контексту (сообщения/токены), логируем “что и почему исключили”.

Важно (observability):

- в `pipeline_step_runs.outputJson` пишем **решения** (какой template, сколько сообщений вошло, summary trimming), а не гигабайты текста.

### F2.3 (опционально v1) — `message_transform` для текущего user input

Только для текущего `userMessageId` и только через variants:

- создать variant (например `kind=normalized|rewritten`)
- (policy-controlled) переключить selected variant, чтобы в prompt попал “красивый” `promptText`
- оригинал остаётся доступен как variant/история

### F2.4 — `promptSnapshotJson` (redacted) и `promptHash`

Минимум v1:

- храним `promptHash` всегда (или почти всегда)
- `promptSnapshotJson` — только redacted и с лимитами размера

Результат нужен для debug report и “почему такой ответ”.

## Критерии готовности

- `pre` реально формирует `PromptDraft` (не только “лог шага”).
- PromptDraft воспроизводим по БД: можно объяснить trimming и выбранные источники.
- Опциональный `message_transform` не ломает инвариант `promptText` и не переписывает прошлую историю.
- Логирование безопасное (redaction-first) и bounded size.

