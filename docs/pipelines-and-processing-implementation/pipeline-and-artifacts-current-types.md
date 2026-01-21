# Текущие типы и поведение: Pipeline + Artifacts (v1, текущее состояние к 2026‑01‑21)

Этот документ — **простое описание того, что реально есть в коде сейчас** (не идеальная будущая спек‑картина).
Источник требований: `docs/pipelines-and-processing-spec/map.md`, а актуальные “что сделано”/ссылки — `docs/pipelines-and-processing-implementation/00-status.md`.

## 1) Основные сущности и где они описаны

- **Исполнение пайплайна (runtime / логи исполнения)**: `shared/types/pipeline-execution.ts`
- **Спека профиля пайплайнов (то, что редактирует UI и хранит server)**: `shared/types/pipeline-profile-spec.ts`
- **Артефакты (персистентные значения по тегам + версии)**: `server/src/services/chat-core/pipeline-artifacts-repository.ts`
- **SessionView (как артефакты попадают в Liquid‑контекст как `art.<tag>`)**: `server/src/services/chat-core/session-view.ts`
- **PromptDraft (как собирается effective prompt + promptInclusion)**: `server/src/services/chat-core/prompt-draft-builder.ts`
- **Post‑processing (blocks + stateWrites в артефакты)**: `server/src/services/chat-core/post-processing.ts`

## 2) Типы исполнения пайплайна (PipelineRun / PipelineStepRun / Generation / PromptDraft)

Все эти типы — “контракты данных v1”, они используются для восстановления/дебага и для UI (в т.ч. по `GET /api/chats/:id/pipeline-state?...`).

### 2.1 `PipelineTrigger`

Что запустило пайплайн‑ран:

- `user_message` — пользователь отправил сообщение
- `regenerate` — перегенерация (новый вариант ассистента)
- `manual` — ручной запуск (на будущее/админка)
- `api` — внешний API‑триггер

### 2.2 `PipelineRun`

Это “шапка” одного запуска (run) вокруг одного хода. Сейчас run создаётся вокруг цепочки шагов **`pre → llm → post`**.

Что хранит (ключевое):

- **идентификаторы и корреляция**:
  - `id`, `ownerId`, `chatId`, `entityProfileId`
  - `branchId` (может быть `null`, но в v1 стараются коррелировать с веткой)
  - `idempotencyKey` (для дедупликации повторных запросов клиента)
- **триггер и статус**:
  - `trigger: PipelineTrigger`
  - `status: "running" | "done" | "aborted" | "error"`
  - `startedAt`, `finishedAt`
- **связи с сообщениями/генерацией**:
  - `userMessageId`, `assistantMessageId`, `assistantVariantId`, `generationId` (все nullable)
- **`meta`**: `unknown | null` (v1 — “мешок” под дебаг/служебную инфу)

### 2.3 `PipelineStepRun`

Одна запись на каждый шаг внутри run (сейчас это три шага: `pre`, `llm`, `post`).

Что хранит:

- `runId` + базовые поля
- **тип шага**:
  - `stepType: "pre" | "llm" | "post"`
  - `stepName: string` (человекочитаемое имя шага; важно для дебага)
- **статус и тайминги**:
  - `status: "running" | "done" | "aborted" | "error"`
  - `startedAt`, `finishedAt`
- **вход/выход шага**:
  - `input: unknown | null`
  - `output: unknown | null`
  - в v1 это используется как “структурированный лог”, например pre‑шаг складывает туда `promptHash`, trimming summary и redacted snapshot
- **ошибка**:
  - `errorCode: PipelineErrorCode | string | null` (предпочтительно — стабильные коды)
  - `errorMessage: string | null` (должно быть безопасно показывать клиенту)

### 2.4 `Generation`

Это запись про LLM‑генерацию (стрим/результат), связанную с пайплайном.

Что хранит:

- **связи**:
  - `pipelineRunId`, `pipelineStepRunId` (nullable)
  - `chatId`, `branchId`
  - `messageId` (в v1 это `assistantMessageId`)
  - `variantId` (может быть `null` как деталь реализации)
- **провайдер/модель/параметры**:
  - `providerId`, `model`, `params: Record<string, unknown>`
- **статус**:
  - `status: "streaming" | "done" | "aborted" | "error"`
  - `startedAt`, `finishedAt`
- **воспроизводимость**:
  - `promptHash: string | null` — sha256 от фактических LLM‑сообщений
  - `promptSnapshot: unknown | null` — redacted “снимок” промпта (ограниченный по размеру)
- **метрики/ошибка**:
  - `promptTokens`, `completionTokens`
  - `error: string | null`

### 2.5 `PromptDraft` и правило `developer → system`

`PromptDraft` — это “доменные сообщения” до отправки в LLM:

- `PromptDraft.messages[]: { role: "system" | "developer" | "user" | "assistant", content: string }`

Важное правило v1 на границе LLM API:

- **`developer` роль маппится в `system`** (чтобы не ломать совместимость с провайдерами/моделями и текущим chat‑core).

## 3) Типы спеки пайплайнов (PipelineProfile.spec v1)

`PipelineProfile.spec` в v1 хранится как JSON и типизирован как:

- `PipelineProfileSpecV1`:
  - `spec_version: 1`
  - `pipelines: PipelineDefinitionV1[]`
- `PipelineDefinitionV1`:
  - `id`, `name`, `enabled`
  - `steps: PipelineStepDefinitionV1[]`
- `PipelineStepDefinitionV1`:
  - `id`, `stepName`, `stepType: "pre" | "llm" | "post"`, `enabled`
  - `params: Record<string, unknown>` — **сейчас намеренно opaque**, т.к. многие поля ещё “заглушки под спеку” и будут типизироваться по мере фаз 2–5.

Как это работает сейчас:

- UI может сохранять любые черновые поля в `step.params`.
- Backend в нескольких местах читает `spec` как `unknown` и парсит только то, что ему нужно (например, `post` читает `blocks` и `stateWrites`).

## 4) Артефакты (Pipeline Artifacts): что это и какие типы есть сейчас

Артефакт — это значение, доступное как:

- **в Liquid‑шаблонах** через `art.<tag>.value` и `art.<tag>.history[]`
- **в UI** (позже) через `uiSurface` (в v1 UI‑рендер артефактов ещё не сделан полностью)

### 4.1 `PipelineArtifactDto` (фактическая форма артефакта на сервере)

Ключевые поля:

- **идентификация**: `id`, `ownerId`, `sessionId` (в v1 `sessionId == chatId`), `tag`
- **тип/назначение**:
  - `kind: string` (в v1 часто `"any"` или `"state"`, строгой типизации ещё нет)
  - `access: "persisted" | "run_only"`
    - по факту в v1 активно используется **`persisted`**
  - `visibility: "prompt_only" | "ui_only" | "prompt_and_ui" | "internal"`
  - `uiSurface: string` (например, `panel:<tag>` — как подсказка, где в UI показывать)
- **контент**:
  - `contentType: "text" | "json" | "markdown"`
  - `contentJson: unknown | null` (только если `contentType="json"`)
  - `contentText: string | null` (если `text/markdown`)
- **влияние на промпт**:
  - `promptInclusion: unknown | null` (хранится JSON‑ом, парсится v1‑логикой в `prompt-draft-builder.ts`)
- **политика истории**:
  - `retentionPolicy: unknown | null`
  - минимально поддержано: `{ mode: "keep_last_n", max: number }` (best‑effort)
- **версии и конкуренция**:
  - `version: number` (инкрементируется)
  - `basedOnVersion: number | null` (optimistic concurrency)
- **“кто записал” (writer identity)**:
  - `writerPipelineId: string | null`
  - `writerStepName: string | null`
- **тайминги**: `createdAt`, `updatedAt`

### 4.2 Версионирование, optimistic concurrency и “single writer”

Запись persisted‑артефакта идёт через `writePersistedArtifact(...)` и соблюдает правила v1:

- **optimistic concurrency**:
  - запись делает новую версию `version = latest.version + 1`
  - если передали `basedOnVersion` и он не совпал с `latest.version` → ошибка `pipeline_artifact_conflict` (HTTP 409)
- **single-writer per tag**:
  - если у тега уже есть `writerPipelineId`, и он отличается от текущего `pipelineId` → ошибка `pipeline_policy_error` (HTTP 403)

### 4.3 Retention (история)

Минимум v1:

- Если `retentionPolicy.mode === "keep_last_n"`, то:
  - при записи делается best‑effort “подрезание” старых версий
  - в `SessionView` в `art.<tag>.history[]` подтягиваются прошлые значения (без текущего) **в порядке old → new**
- Если политики нет/не распознана — режим “overwrite”:
  - `history[]` будет пустой (показывается только `value`)

## 5) SessionView: как `art.<tag>` попадает в Liquid

`SessionView` сейчас выглядит так:

- `SessionView = { art: Record<string, SessionViewArtifact> }`
- `SessionViewArtifact`:
  - `value: unknown` — текущее значение (из latest persisted версии)
  - `history: unknown[]` — прошлые значения (если keep_last_n)
  - `meta` — метаданные (tag/kind/version/visibility/uiSurface/contentType/updatedAt/writer…)

Важно:

- `buildChatSessionViewSafe(...)` **никогда не кидает исключение**: если что-то сломалось/нет миграции — вернёт `{ art: {} }`, чтобы шаблоны не падали.

## 6) `promptInclusion`: как артефакты влияют на effective prompt в v1

Артефакты участвуют в prompt только если:

- `visibility` равен `prompt_only` или `prompt_and_ui`
- `promptInclusion.mode` не `"none"`

Текущий поддерживаемый формат `promptInclusion` (v1):

- `mode`: `"none" | "prepend_system" | "append_after_last_user" | "as_message"`
- `role?`: `"system" | "developer" | "user" | "assistant"` (по умолчанию **`developer`**)
- `format?`: `"text" | "json" | "markdown"` (по умолчанию выводится из `contentType`)

Как вставляется:

- **`prepend_system`**: добавляет текст артефакта в начало system prompt (детерминированно)
- **`append_after_last_user`**: вставляет сообщение сразу после последнего `user` в истории
- **`as_message`**: добавляет сообщение в хвост промпта (после истории)

Детерминированный порядок включений (v1 минимум):

- порядок пайплайнов в активном `PipelineProfile.spec` (если передан)
- затем порядок по “типу шага” writer‑а (`pre` → `llm` → `post`)
- затем `tag`
- затем `version`

В результате `buildPromptDraft(...)` возвращает ещё и `artifactInclusions[]` — компактный лог того, **какие артефакты реально вошли в prompt**, и как именно.

## 7) Post‑processing: blocks и stateWrites (артефакт “state”)

После завершения LLM‑стрима выполняется `runPostProcessing(...)`:

### 7.1 Blocks (канонизация ответа для UI)

Сейчас есть `blocksMode`:

- `single_markdown` — один markdown‑блок (контент = `promptText`)
- `extract_json_fence` — попытаться вытащить первый fenced‑блок ```json ...``` и сохранить как структурированный UI‑only блок; если не получилось — fallback в markdown

Результат всегда пишется как `blocks` в вариант сообщения ассистента.

### 7.2 State writes → persisted артефакты

`post` читает `activeProfileSpec` и вытаскивает из `post`‑шагов массив `stateWrites[]`.

Каждый `stateWrites` описывает запись в `art.<tag>`:

- `tag`, `kind`, `visibility`, `uiSurface`
- `contentType: "text" | "json" | "markdown"`
- `promptInclusion?`, `retentionPolicy?`
- `source`:
  - `assistant_response_json_fence` (по умолчанию для `json`)
  - `assistant_response_text` (для текстовых типов)
- `required: boolean`
- `writer: { pipelineId, stepName }` — для single‑writer правила

Поведение:

- если `source=json_fence` и JSON fence не найден/не парсится:
  - `required=false` → запись **skipped**
  - `required=true` → **error**
- запись всегда идёт как новая версия persisted‑артефакта с `basedOnVersion = latest.version` (или `null`, если артефакта ещё не было)
- результат post‑processing возвращает `stateWrites[]` с `status: written|skipped|error` и, если written, то `artifactId/newVersion`.

## 8) Что важно помнить про “текущее состояние v1”

- `PipelineProfile.spec` и многие вложенные штуки (особенно `params`) ещё не строгие типы — это осознанно “временная opaque зона”.
- Артефакты сейчас фактически **chat‑scoped** (`sessionId == chatId`) и используются как механизм композиции влияний нескольких пайплайнов на prompt через `promptInclusion`.
- UI‑рендер артефактов по `uiSurface` (панели/ленты) — ещё не доведён до конца (в `00-status.md` отмечено как TODO на стороне web).

