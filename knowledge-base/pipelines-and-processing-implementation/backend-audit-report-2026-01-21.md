# Отчёт: аудит реализации Pipelines + Pre/Post Processing (backend)

Дата: 2026‑01‑21  
Область: `server/` (chat-core orchestration, pipelines/profiles/artifacts, SSE, DB)  
Источник требований: спекa `knowledge-base/pipelines-and-processing-spec/map.md` (v0.1) и статус‑реализация `knowledge-base/pipelines-and-processing-implementation/00-status.md`.

---

## Краткий итог

Текущее состояние бекенда **в целом соответствует “v1-минимум” из `00-status.md`** (pre → llm → post вокруг существующего стрима, базовые таблицы, PipelineProfile bindings, артефакты + SessionView, recovery API).

При этом найдены **существенные расхождения со спекой и/или рискованные решения**, в первую очередь:

- **Критично: “redacted prompt snapshot” фактически не redaction, а просто truncation** → возможное хранение PII/секретов/внутренних инструкций в БД.
- **Баг детерминизма: `prepend_system` для артефактов инвертирует порядок** (реальный порядок обратный заявленному).
- **Идемпотентность/дедуп** реализована через client‑sent `requestId`, что расходится со спекой (и оставляет “дыры” при отсутствии `requestId`).
- **Нет транзакционности** для ключевых многотабличных операций (run/steps/generation/messages/variants) → риск “полу‑состояний”.
- **Нет валидации коллизий persisted tags на уровне активации/сохранения профиля** (спекой рекомендовано; у вас это отмечено как TODO).

---

## Методика сверки

1) Из спеки собраны инварианты и ожидаемое поведение: triggers, idempotency, mutation policy, step semantics, artifacts/session view, observability/logging/redaction, SSE envelope и recovery.  
2) Сверено с фактической реализацией ключевых модулей:

- SSE send/regenerate: `server/src/api/chats.core.api.ts`, `server/src/api/message-variants.core.api.ts`
- Оркестратор стрима: `server/src/services/chat-core/orchestrator.ts`
- Pre (PromptDraft): `server/src/services/chat-core/prompt-draft-builder.ts`
- Post: `server/src/services/chat-core/post-processing.ts`
- Артефакты/SessionView: `server/src/services/chat-core/pipeline-artifacts-repository.ts`, `server/src/services/chat-core/session-view.ts`
- Runs/Steps/Generations: `server/src/services/chat-core/pipeline-runs-repository.ts`, `server/src/services/chat-core/pipeline-step-runs-repository.ts`, `server/src/services/chat-core/generations-repository.ts`
- Profiles/bindings: `server/src/services/chat-core/pipeline-profile-resolver.ts`, `pipeline-profiles-repository.ts`, `pipeline-profile-bindings-repository.ts`, `server/src/api/pipeline-profiles.core.api.ts`
- Debug/State API: `server/src/services/chat-core/pipeline-debug.ts`, `pipeline-state.ts`, `server/src/api/pipeline-debug.core.api.ts`, `pipeline-state.core.api.ts`
- SSE infra: `server/src/core/sse/sse.ts`
- DB: `server/src/db/schema.ts`

---

## Расхождения и проблемы (с приоритетами)

### 1) Logging/Privacy: prompt snapshot НЕ является redacted (КРИТИЧНО)

- **Ожидание (спека)**: `promptSnapshotJson` и step‑логи должны быть **redaction‑first**, без “сырых” секретов/PII/chain‑of‑thought; допустимы redacted/summary/hash; size bounded (`55-logging-and-reproducibility.md`).
- **Факт (код)**:
  - `buildRedactedSnapshot(...)` в `prompt-draft-builder.ts` просто режет по длине (MAX_MSG_CHARS/MAX_TOTAL_CHARS), **не маскирует** и не классифицирует чувствительные данные: `server/src/services/chat-core/prompt-draft-builder.ts:L176-L215`.
  - Этот snapshot сохраняется **и в `pipeline_step_runs.outputJson`, и в `llm_generations.promptSnapshotJson`**:
    - запись в step output: `server/src/api/chats.core.api.ts:L569-L586` и аналогично regenerate `server/src/api/message-variants.core.api.ts:L412-L428`
    - запись в generation: `updateGenerationPromptData`: `server/src/services/chat-core/generations-repository.ts:L142-L158`
- **Почему это плохо**:
  - “redacted snapshot” может содержать **API keys, персональные данные, приватные инструкции, артефакты**, и это попадёт в БД/бэкапы.
  - В `00-status.md` это заявлено как “redacted” (Phase 2/6), но реализация не соответствует смыслу redaction.
- **Рекомендация**:
  - Ввести реальную redaction‑политику (минимум: маскировать секрет‑подобные паттерны, ограничивать system sections, исключать `internal`/reasoning‑подобные блоки, настраивать режимы `hash-only/summary`).
  - Развести “truncate” и “redact” как разные этапы; добавить явный флаг “redacted=true” и причины/правила в meta.

### 2) Детерминизм prompt: `prepend_system` инвертирует порядок (КРИТИЧНО/БАГ)

- **Ожидание (спека)**: порядок включения артефактов детерминирован; tie‑break: profile order → step order → tag → version (`40-artifacts.md`).
- **Факт (код)**: inclusions сортируются, но `prepend_system` применяется как `systemPrompt = \`${content}\n\n${systemPrompt}\`` в цикле:
  - `server/src/services/chat-core/prompt-draft-builder.ts:L281-L297`
  - Комментарий говорит “earlier items go closer to the start”, но по факту второй prepend оказывается выше первого (получается обратный порядок).
- **Импакт**: “system prepend chain” становится **недетерминированным относительно ожидаемого порядка** (для пользователя/дебага это будет выглядеть как “почему инструкции поменялись местами”).
- **Рекомендация**: собирать prepend‑части в массив и склеивать один раз (или prepend делать в обратном порядке намеренно, но тогда исправить сортировку/комментарий).

### 3) Idempotency/dedup: расхождение со спекой + “дыры” при отсутствии `requestId` (ВАЖНО)

- **Ожидание (спека `10-execution-model.md`)**:
  - `user_message`: дедуп ключ = `(chatId, userMessageId)`
  - `regenerate`: дедуп ключ = `(chatId, assistantVariantId)` (или стабильный идентификатор регенерации)
  - повтор запроса с тем же ключом не должен создавать новый run/generation.
- **Факт (код)**:
  - Реальная идемпотентность сделана через client‑sent `requestId` → `pipeline_runs.idempotency_key = user_message:<branchId>:<requestId>`:
    - `server/src/api/chats.core.api.ts:L333-L336`, `ensurePipelineRun`: `server/src/services/chat-core/pipeline-runs-repository.ts:L77-L160`
  - Для regenerate: `idempotency_key = regenerate:<assistantMessageId>:<requestId>` (используется messageId, не variantId):
    - `server/src/api/message-variants.core.api.ts:L222-L225`
  - Если `requestId` не передан, дедуп по turn‑у **не применяется** (и возможны дубли runs/messages/generations).
- **Импакт**:
  - Это расходится с формулировкой спеки и может давать разные “канонические” runs при сетевых ретраях.
  - В “мульти‑клиент” сценариях отсутствие `requestId` превращается в источник гонок.
- **Рекомендации**:
  - Обновить спеку/статус: зафиксировать, что v1 требует client‑sent idempotency key (иначе нельзя предотвратить дубль POST).
  - Для regenerate логичнее базировать дедуп на **assistantVariantId** (как в спеке), либо явно зафиксировать, почему выбран assistantMessageId.

### 4) SSE progress events: тайминг `pipeline.run.started` и pre‑step событий не соответствует рекомендациям (ВАЖНО)

- **Ожидание (спека `60-sse-events.md`)**: `pipeline.run.started` должен приходить “как можно раньше” (сразу после создания `PipelineRun`), чтобы UI не выглядел зависшим; step events должны отражать реальный прогресс.
- **Факт (код)**:
  - `pipeline.run.started` отправляется **после** создания Generation и завершения pre‑step:
    - `server/src/api/chats.core.api.ts:L647-L656` (pre уже `done`, потом только event)
  - Для UI “pre step started/done” эмитятся **после факта**: `server/src/api/chats.core.api.ts:L652-L656` и аналогично в regenerate `server/src/api/message-variants.core.api.ts:L491-L495`.
- **Импакт**:
  - UI не увидит ранний прогресс; дебаг‑тайминг шагов по SSE не совпадёт с DB‑таймингом шагов.
- **Рекомендация**: эмитить `pipeline.run.started` сразу после `create/ensurePipelineRun`, а `pipeline.step.started` — сразу после `createPipelineStepRun` (до тяжёлых операций).

### 5) Mutation policy / “очередь коммитов” из спеки не реализована (ВАЖНО)

- **Ожидание (спека `10-execution-model.md`)**: любые изменения, влияющие на историю/UI‑поток, должны проходить через **последовательную очередь коммитов** per `(chatId, branchId)`; только один “main LLM” стримит в историю в момент времени.
- **Факт (код)**:
  - Есть **частичные guard’ы**, но нет системной очереди:
    - regenerate ограничен “только последнее сообщение” (`server/src/api/message-variants.core.api.ts:L148-L158`)
    - abort есть (`server/src/api/generations.core.api.ts`, `server/src/services/chat-core/generation-runtime.ts`)
  - Для `user_message` без `requestId` отсутствует серверный механизм исключить параллельные runs.
- **Импакт**: возможны гонки (несколько стримов/flush в один чат/ветку, несогласованность `activeVariantId`, “вечные running” при крашах между шагами).
- **Рекомендация**: хотя бы v1‑минимум — “single active generation per chat+branch” guard в начале SSE send/regenerate (и понятная ошибка `pipeline_policy_error`/`pipeline_idempotency_conflict`).

### 6) Транзакционность/атомарность отсутствует почти везде (КАЧЕСТВО/ВАЖНО)

- **Факт (код)**:
  - В `selectMessageVariant` сначала сбрасываются все `isSelected=false`, потом выставляется один `true`, потом обновляется `chat_messages` — без транзакции:
    - `server/src/services/chat-core/message-variants-repository.ts:L79-L99`
  - В SSE send/regenerate создаются/обновляются `chat_messages`, `message_variants`, `pipeline_runs`, `pipeline_step_runs`, `llm_generations` каскадом — без транзакции (см. большие блоки в `chats.core.api.ts` и `message-variants.core.api.ts`).
  - В `createChat` вставляются chat + branch + update chat.activeBranchId без tx:
    - `server/src/services/chat-core/chats-repository.ts:L163-L201`
- **Импакт**: при исключении/краше/kill процесса возможны “полу‑состояния”, которые потом сложно чинить и которые ломают “backend source of truth”.
- **Рекомендация**: использовать транзакции там, где меняется несколько таблиц как один инвариант (варианты/selected/cache; создание turn-а; создание чата).

### 7) Валидация коллизий persisted tags на уровне профиля отсутствует (РАСХОЖДЕНИЕ СО СПЕКОЙ)

- **Ожидание (спека `40-artifacts.md` + `20-mutation-policy.md`)**: коллизии `tag` и single‑writer должны выявляться при сохранении/активации профиля + runtime guard.
- **Факт (код)**:
  - Runtime guard есть (`writePersistedArtifact` запрещает писать в чужой tag): `server/src/services/chat-core/pipeline-artifacts-repository.ts:L177-L184`
  - Но **валидации на set active profile нет**, что прямо отмечено как TODO в `00-status.md` (Phase 4.5 TODO).
- **Импакт**: пользователь может собрать профиль, который “на бумаге работает”, но в рантайме будет падать policy‑ошибками.
- **Рекомендация**: при сохранении/активации профиля валидировать декларацию write targets (минимум: `stateWrites`), проверять уникальность `(pipelineId, tag)` и single‑writer.

### 8) Смешение “legacy pipelines” и “pipeline profiles” (АРХИТЕКТУРА/КАЧЕСТВО)

- **Факт**:
  - Есть таблица/CRUD `pipelines` (`server/src/api/pipelines.api.ts`, `server/src/services/chat-core/pipelines-repository.ts`) и отдельная новая модель `pipeline_profiles`.
  - Есть ещё legacy settings в JSON (`server/src/services/pipelines-settings.service.ts`, `server/src/legacy/services/pipelines.service.ts`) и endpoint `/settings/pipelines`: `server/src/api/pipelines.api.ts:L22-L38`.
  - При этом реальный runner сейчас использует **жёстко заданный** `DEFAULT_PIPELINE_ID = "builtin:default_v1"`:
    - `server/src/api/chats.core.api.ts:L62-L64`, `server/src/api/message-variants.core.api.ts:L55-L57`
- **Импакт**: высокая вероятность путаницы в UI/данных/отладке (“какой пайплайн реально исполнился?”), плюс сложнее мигрировать off JSON.
- **Рекомендация**: либо явно объявить `pipelines`/legacy как deprecated и отделить маршруты, либо связать `PipelineProfile.spec` с реальными pipeline definitions (или убрать unused слой).

### 9) `PipelineProfile.spec` парсится через `any` и “частичную” схему (КАЧЕСТВО/ТИПЫ)

- **Факт**:
  - В `prompt-draft-builder.ts` используется `(spec as any).pipelines` и нет типобезопасного валидатора: `server/src/services/chat-core/prompt-draft-builder.ts:L137-L149`.
  - В `post-processing.ts` `PipelineProfileSpecV1` объявлен локально и парсится “best-effort”, игнорируя неизвестные поля: `server/src/services/chat-core/post-processing.ts:L16-L37`.
  - В `pipeline-debug.ts` чтение step output через `as any`: `server/src/services/chat-core/pipeline-debug.ts:L220-L221`.
- **Импакт**: “opaque JSON” превращается в скрытые runtime‑ошибки, а не в явные ошибки валидации; сложнее эволюционировать spec v2.
- **Рекомендация**: единая zod‑валидация `PipelineProfileSpecV1` на сервере (в одном месте), без `any`.

### 10) Артефакты: чтение “latest” реализовано как full scan (ПРОИЗВОДИТЕЛЬНОСТЬ/КАЧЕСТВО)

- **Факт**: `listLatestPersistedArtifactsForSession` читает **все версии всех тегов** и потом выбирает “первую на тег”:
  - `server/src/services/chat-core/pipeline-artifacts-repository.ts:L113-L135`
- **Импакт**: при большом числе версий (особенно `feed:*`) это станет узким местом на каждом build prompt / materialize SessionView.
- **Рекомендация**: либо “head pointer”/таблица latest, либо запросы вида “max(version) group by tag” + join, либо индексированная стратегия с ограничениями.

### 11) Blocks/visibility: несогласованность с терминологией спеки (ЗАМЕТКА)

- **Факт**:
  - `post-processing.ts` создаёт блок с `visibility: "both"` для markdown (`server/src/services/chat-core/post-processing.ts:L171-L180`), тогда как в спеке основные значения — `prompt_only/ui_only/prompt_and_ui/internal`.
- **Импакт**: потенциальная несовместимость будущего UI/рендера с артефактной моделью visibility.
- **Рекомендация**: унифицировать enum/термины (или явно зафиксировать blocks‑visibility как legacy‑слой).

### 12) Branch vs artifacts session: артефакты общие на чат, но prompt строится per branch (ЗАМЕТКА/СЕМАНТИКА)

- **Ожидание (спека)**: v1 intentionally chat‑scoped session (артефакты не разделяются по branchId).
- **Факт**: build prompt для конкретной ветки всё равно подмешивает chat‑scoped артефакты:
  - `server/src/services/chat-core/prompt-draft-builder.ts:L241-L245`
- **Импакт**: в UX веток это может выглядеть как “артефакты протекли в другую ветку”. Это соответствует спеке, но важно явно зафиксировать в продуктовых ожиданиях.

---

## Сверка с `00-status.md` (где заявлено “done”, но есть нюансы)

- **Phase 2/6: “redacted promptSnapshotJson + promptHash”** — `promptHash` есть, но “redacted” не выполнено по смыслу (см. раздел 1).
- **Phase 4: ordering `profile → step → tag → version`** — формально реализовано, но `prepend_system` ломает порядок (см. раздел 2).
- **Phase 4.3/4.5: коллизии persisted tags** — runtime guard есть, но pre‑валидации при активации профиля нет (см. раздел 7; в статусе это помечено как TODO).

---

## Что сделать в первую очередь (рекомендованный приоритет)

1) **Приватность**: реальная redaction‑политика для snapshots/step logs + пересмотр “что вообще логировать текстом”.  
2) **Баг**: исправить порядок `prepend_system`.  
3) **Надёжность**: минимальные транзакции на multi‑write инварианты (variants selection, создание turn‑а).  
4) **Concurrency**: серверный guard “single active generation per chat+branch” (даже если UI уже старается).  
5) **Профили/валидация**: validation коллизий persisted tags при сохранении/активации профиля.

