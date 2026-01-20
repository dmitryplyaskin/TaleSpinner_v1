# TaleSpinner — Pipelines + Pre/Post Processing Spec (v0.1) — Logging & reproducibility

> Статус: **draft** для обсуждения.  
> Цель: вынести правила логирования/наблюдаемости в отдельный документ, чтобы не “мусорить” ими в описании шагов/артефактов/исполнения.

## Зачем (v1)

Логирование должно отвечать на вопросы:

- **Почему получился такой ответ?**
- **Что именно ушло в LLM (в redacted виде)?**
- **Какие шаги выполнялись и что они сделали?**
- **Где случилась ошибка/аборт и на каком шаге?**

## User-facing debug report (“как A,B,C → X”)

В v1 считаем нормой, что пользователь может открыть “debug report” и получить **понятную картинку**, что именно “работало под капотом” для формирования результата.

Минимальный состав такого отчёта:

- **Почему запустилось**:
  - `trigger` (новое сообщение / regenerate / manual / api)
  - ключ дедупликации turn-а (чтобы было видно “это повтор или новый запуск”)
- **Что было входом**:
  - user message (id + текст выбранного варианта)
  - полная история чата (как канон, `promptText` выбранных variants)
- **Что реально ушло в LLM (effective prompt)**:
  - финальный `PromptDraft.messages[]` в порядке отправки (role + content), в redacted виде при необходимости
  - маппинг ролей (например `developer` → `system`), если применялся
  - сведения о trimming: что было исключено и почему (лимиты/правила/сводка)
- **Какие “инструменты” участвовали**:
  - активный `PipelineProfile` (id/версия) и список пайплайнов/шагов с их статусами/таймингами
  - для каждого шага — кратко “что изменил/добавил” (без больших полотен текста)
- **Какие артефакты использовались**:
  - список `art.<tag>`, которые были прочитаны/включены в промпт (tag + version + как использовалось)
  - список `art.<tag>`, которые были обновлены (old/new version, `basedOnVersion`, краткий diff/summary)
- **Параметры генерации**:
  - provider/model, `paramsJson`, usage tokens (если есть), длительность
- **Ограничения приватности**:
  - явная отметка, что reasoning/working-notes либо отсутствуют, либо представлены как redacted/summary/hash.

## Принципы

- **Backend source of truth**: каноническая “истина процесса” хранится в БД (`pipeline_runs`, `pipeline_step_runs`, `llm_generations`).
- **Минимум, но достаточно**: логируем то, что помогает объяснить результат и дебажить, но не превращаем БД в “сырые логи”.
- **Redaction-first**: всё, что потенциально содержит секреты/PII/“сырой reasoning”, хранится только в redacted/summary/hash форме.
- **Bounded size**: все поля логов имеют лимиты размера (truncate/omit), чтобы логирование не ломало производительность.

## Корреляция (что связывает записи)

Минимальный набор идентификаторов, которые должны коррелировать записи между таблицами и SSE:

- `chatId`
- `userMessageId?`
- `assistantMessageId`, `assistantVariantId`
- `runId`
- `stepRunId`
- `generationId?`

## Что логируем (v1 минимум)

### `pipeline_runs`

- `trigger` (`user_message|regenerate|manual|api`)
- `status` (`running|done|aborted|error`)
- `startedAt/finishedAt`
- привязки к `chatId`/`entityProfileId`
- (рекомендуемо) ссылка/идентификатор активного `PipelineProfile` (и/или его ревизии), чтобы понимать “какой набор пайплайнов был включён”

### `pipeline_step_runs`

Общее:

- `stepType`
- `status` + `timings`
- `inputJson` / `outputJson` — **в разумных пределах** (см. лимиты ниже)
- `error` (code/message/details) при `error`

Рекомендация по содержимому `inputJson/outputJson`:

- Логировать **факты принятия решений** (например: выбранный template, параметры trimming, предупреждения, ids использованных сущностей), а не большие “полотна текста”.

### `llm_generations`

- `provider/model`
- `paramsJson` (settings)
- `status` (`streaming|done|aborted|error`)
- usage (`promptTokens/completionTokens`), если доступно
- (опционально) `promptSnapshotJson` — **только redacted** (см. ниже)
- (рекомендуемо) `promptHash` — стабильный хеш, чтобы сопоставлять “одинаковые промпты” без хранения сырых данных

## Политика redaction (v1)

### Что не храним “как есть”

- секреты/токены/ключи провайдеров
- персональные данные (если они могут быть в тексте)
- “сырой chain-of-thought / reasoning” модели

### `Augmentation` (pre-CoT / working-notes)

Разрешённые режимы хранения в логах:

- **redacted** — обрезка/маскирование
- **summary** — короткий synopsis (без деталей/секретов)
- **hash-only** — только хеш (если содержимое хранить нельзя)

Где хранить:

- `pipeline_step_runs.outputJson` (предпочтительно)
- и/или `llm_generations.promptSnapshotJson` (если augmentation реально был включён в prompt и это важно для дебага)

### `promptSnapshotJson`

- хранится только в redacted виде:
  - без секретов,
  - с урезанием размера,
  - с `promptHash`.

## Лимиты и retention (v1)

В v1 достаточно зафиксировать принципы (конкретные числа можно уточнить при реализации):

- `pipeline_step_runs.inputJson/outputJson`: truncate/omit больших полей, хранить только summary/ids.
- `promptSnapshotJson`: хранить редкий/ограниченный по размеру снапшот; остальное — через `promptHash`.
- большие артефакты/истории — не дублировать в логах целиком (достаточно ссылок: `tag`, `basedOnVersion`, `newVersion`, краткий diff/summary).

## Debug-only снапшоты (v1)

Если нужен “большой снапшот” для дебага, он должен быть:

- **debug-only** (не влияет на канон и не участвует в обычном флоу),
- храниться отдельно от основных сущностей процесса,
- иметь явные лимиты/TTL.

## Ошибки и аборты (логирование)

Минимум:

- кто упал: `runId/stepRunId/generationId`
- причина: `errorCode` + короткое `message`
- статусные поля (`aborted|error`)

Подробности (stack traces / raw payloads) — по возможности в серверных логах, а в БД — только safe summary.

