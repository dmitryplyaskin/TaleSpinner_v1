# TaleSpinner — Pipelines + Pre/Post Processing Spec (v0.1) — Artifacts

> Статус: **draft** для обсуждения.  
> Цель: зафиксировать архитектуру пайплайнов и пре/постпроцессинга, совместимую с текущим chat-core флоу, чтобы дальше согласовать API и начать реализацию.

> Примечание: это часть спеки, выделенная из монолита `pipelines-and-processing-spec-v0.1.md`.

## PipelineArtifact, блоки и “внешние” UI поверхности

Этот раздел фиксирует расширение модели: вместо того чтобы ограничиваться `blocksJson` “только в сообщениях”,
мы вводим **PipelineArtifact** как универсальную сущность, которая покрывает:

- prompt-only вставки (pre-CoT augmentation),
- ui-only контент (комментарии/индикаторы/спойлеры),
- prompt+ui данные,
- “внешние” UI поверхности: панели/ленты/оверлеи, которые не являются сообщениями истории.

### Две независимые оси: `visibility` и `uiSurface`

Ключевая идея: “участвует ли в prompt” и “где отображается” — разные вещи.

- **`ArtifactVisibility`** определяет участие в prompt/UI (`prompt_only | ui_only | prompt_and_ui | internal`).
- **`UiSurface`** определяет где показывать в UI (`chat_history | panel:* | feed:* | overlay:*`).

Примеры:

- Pre-CoT: `visibility=prompt_only`, `uiSurface=internal` (или вообще без UI surface), `retention=ephemeral`.
- RPG state: `visibility=prompt_and_ui`, `uiSurface=panel:rpg_state`, `retention=durable`.
- “Реддит-комментаторы”: `visibility=ui_only`, `uiSurface=feed:commentary`, `retention=durable|ttl`.
- “GM note to player, и чтобы LLM тоже видел”: `visibility=prompt_and_ui`, `uiSurface=chat_history` (или `panel:*`), `retention=durable`.

### Базовая позиция v1

- Канон для prompt — `promptText`.
- `PipelineArtifact` — каноническая единица “созданного пайплайном контента”.
- `blocksJson` остаётся, но трактуется как:
  - либо denorm представление части артефактов для `uiSurface=chat_history`,
  - либо legacy-совместимый UI-слой (пока не мигрировали UI на чтение артефактов напрямую).

### Артефакты в prompt: правила включения (prompt injection)

Чтобы prompt был воспроизводим и объясним, для артефактов задаётся явная политика включения:

- **`promptInclusion.mode`**:
  - `none` (никогда не включать в prompt)
  - `append_after_last_user` (после последнего user сообщения) — ключевой кейс pre-CoT
  - `prepend_system` (в начале system)
  - `as_message` (как отдельное синтетическое сообщение с ролью)
- **`promptInclusion.role`**: `system | developer | assistant | user` (по умолчанию безопаснее `developer`/`system`)
- **`promptInclusion.format`**: `text | json | markdown` (и правила сериализации)

`promptInclusion.mode` — это **shorthand** для самых частых кейсов.
При необходимости он раскрывается в более детальные поля (`operation/target/anchor/phase/priority`), описанные ниже.

> Важный принцип: артефакт с `uiSurface=panel:*` может участвовать в prompt, если `visibility` допускает и задан `promptInclusion`.

#### Роли: доменная роль vs роль провайдера

Чтобы не привязываться к конкретным API провайдера, различаем:

- **доменную роль**: `system | developer | user | assistant`
- **роль провайдера** (то, что реально уходит в LLM API): обычно `system | user | assistant`

Правило v1:

- `developer` маппится в `system` (или в отдельный “system section”), пока не введём отдельную provider-роль везде.

Практические эвристики:

- артефакт, созданный автоматикой/LLM (pre/post), по умолчанию **не должен** идти как `user`,
- `user`-роль допустима, если артефакт является “проекцией/нормализацией” **текущего user ввода** (см. `message_transform` ниже).

#### Операции включения: `insert / replace / wrap / merge`

Одного `mode` недостаточно: пользователи захотят “replace/merge/append” и вставки “на глубину”.
Поэтому концептуально вводим:

- **`promptInclusion.operation`** (что делаем с target):
  - `insert` — вставить синтетическое prompt-only сообщение
  - `replace` — заменить target (system или конкретное сообщение) **в PromptDraft**
  - `wrap` — обернуть target: `pre` + target + `post`
  - `merge_section` — обновить/слить именованную секцию (в system или в JSON state)
- **`promptInclusion.target`**:
  - `system` (system prompt целиком или его секция)
  - `timeline` (вставка как сообщение в PromptDraft.messages)
  - `message_ref` (конкретное сообщение, выбранное селектором/якорем)

> Важно: операции `replace/wrap/merge_section`, применённые к сообщениям, по умолчанию действуют **только на PromptDraft**.
> Каноническая история меняется только через `message_transform` (см. ниже) или через отдельные “исторические трансформации”.

#### Якоря/вставка “на глубину” (anchor + depth policy)

Чтобы можно было вставить “на 4 сообщения назад” и при этом не зависеть от случайного trimming,
позиционирование задаётся как **селектор + политика**:

- **`promptInclusion.anchor`** (селектор позиции):
  - `after_last_user`
  - `before_last_assistant`
  - `after_message_id:<id>`
  - `relative_to_end(offset=-4, roleFilter=any|user|assistant)`
  - `relative_to_anchor(anchor=after_last_user, offset=-4)` (если хочется “от последнего user”)
- **`promptInclusion.place`**: `before | after | replace | wrap`
- **`promptInclusion.depthPolicy`** (если якорь/сообщение не попало в окно контекста из-за trimming):
  - `strict_drop` — не вставлять
  - `clamp_to_oldest_kept` — вставить рядом с самым старым сообщением, которое осталось
  - `relocate_to_nearest` — переякорить к ближайшему доступному

Это покрывает кейс “лоровые заметки поближе к актуальному контексту, но не в самом конце”.

#### Порядок (ordering) артефактов в prompt

Если несколько артефактов включаются в prompt, порядок должен быть детерминированным.

Вводим поля:

- **`promptInclusion.phase`** (грубая стадия): `system | early | near_anchor | after_last_user | tail`
- **`promptInclusion.priority`** (число, чем меньше — тем раньше внутри phase)

Детерминированный tie-break v1 (если совпали):

1. порядок шагов пайплайна (PipelineStepRun order)
2. `tag` (лексикографически; стабильный ключ)
3. `version` (если применимо) / `id`

Это позволяет пользователям контролировать “в каком порядке оно добавляется в prompt”.

Рекомендуемо в v1:

- Стримить только текст (`llm.stream.delta`), обновляя буфер `promptText`.
- Генерировать/обновлять `blocksJson` **только на финале** (в `post`).

Опционально (v2+):

- добавить SSE события для blocks:
  - `message.blocks.ready` (одним payload после done)
  - `message.block.delta` (инкрементальные блоки)

### Reasoning

Если reasoning хранится:

- хранить как block `type=reasoning` с `visibility=ui_only`,
- по умолчанию reasoning не должен попадать в `promptText`.

> В терминах артефактов reasoning — это либо `PipelineArtifact` с `visibility=internal/ui_only`,
> либо блок внутри `uiSurface=chat_history`-артефакта (в зависимости от того, как будет удобнее UI).

---

## PipelineArtifact storage & `art.<tag>` view (v1)

Этот раздел фиксирует отдельную сущность, которая позволяет “поломать” текущий минимализм ради удобного API и расширяемости.

Идея: pipeline step может создавать/обновлять артефакты разных типов, а UI и PromptDraft “подписываются” на них.

### Зачем отдельная сущность

`chat_messages` и `message_variants` хорошо подходят для истории диалога, но плохо масштабируются под:

- внешние UI поверхности (панели/ленты),
- prompt-only вставки,
- состояния/память, которая живёт “поверх” истории,
- комментирующие/мета-слои, не являющиеся частью истории.

### Базовая модель артефакта (логическая)

- `id`
- `ownerId`
- `sessionId` (v1: `chatId`) — “место жизни” persisted-артефактов (см. термин **Session** в `00-overview.md`)
- `tag`:
  - `access=persisted`: string, **обязательно**, уникально (единая точка адресации как `art.<tag>`)
  - `access=run_only`: опционально (может отсутствовать или быть локальным; уникальность не требуется)
- `kind` (string) — например: `augmentation | state | commentary | stats | any`
- `access` (`run_only | persisted`) — определяет, доступен ли артефакт как `art.<tag>` и может ли быть входом для других пайплайнов
- `visibility` (`prompt_only | ui_only | prompt_and_ui | internal`)
- `uiSurface` (`chat_history | panel:<id> | feed:<id> | overlay:<id> | internal`)
- `contentType` (`text | json | markdown`)
- `contentJson` / `contentText`
- `promptInclusionJson` (nullable) — правила включения в prompt (см. выше)
- `retentionPolicyJson` — overwrite/append/ttl/maxVersions и т.п.
- `version` (int или uuid)
- `basedOnVersion` (nullable)
- `createdAt`, `updatedAt`

Дополнение (важно для твоего кейса со “статами”):

- **Логический persisted-артефакт** определяется ключом \(ownerId, sessionId, tag\).  
  Остальные поля (`kind`, `uiSurface`, `visibility`) — свойства этого артефакта и не участвуют в уникальности имени.

Правило уникальности `tag` (v1):

- `tag` уникален **в пределах (`ownerId`, `sessionId`)** для `access=persisted` (v1: “в пределах чата”).
- попытка создать второй persisted-артефакт с тем же `tag` — **ошибка конфигурации/валидации** (коллизия имени).
- Поле `version` делает артефакт **версионируемым**: одна логическая сущность может иметь много версий (история изменений).
- Для UI и для prompt почти всегда нужен не “все версии”, а **материализованное представление** (обычно “последняя версия”).
  Это можно реализовать либо отдельным “head pointer”, либо запросом “latest by createdAt/version”.

### Доступ из LiquidJS

Останавливаемся на одном пространстве имён:

- **`art.<tag>`** — доступ к артефакту по уникальному `tag`.

Ключевая договорённость (shape):

- `art.<tag>.value` — **последний (актуальный) результат** артефакта (то, что “получили бы по tag.value”):
  - либо `contentJson`,
  - либо `contentText` (зависит от `contentType`).
- `art.<tag>.history[]` — массив **предыдущих** значений `value` *в том же формате*, размер/состав которого определяется политикой “жизни” (retention).
  - `history` **не включает** текущее `value`.

Уточнение:

- `art.<tag>` относится только к артефактам с `access=persisted`.
- `access=run_only` артефакты существуют как промежуточные результаты внутри run и (в v1) наблюдаемы через `pipeline_step_runs`/snapshot, но не как адресуемые `art.*`.

> Реальный синтаксис доступа/фильтров Liquid (например “последний элемент history”) уточним позже.
> Здесь фиксируем именно **семантику** и гарантии структуры.

### Правила write/read доступа (v1)

Ключевой guardrail (v1):

- **Single-writer per persisted `tag`**: каждый persisted-артефакт `art.<tag>` имеет **ровно одного writer-а** (пайплайн-владельца).  
  Пайплайн **не может** писать в `tag`, который ему не принадлежит.

Упрощение v1:

- persisted-артефакты в рамках **Session** считаются **доступными на чтение** для шагов/пайплайнов (границы задаются не ACL между пайплайнами, а:
  - тем, что включаем в prompt через `promptInclusion`,
  - тем, что показываем в UI через `visibility/uiSurface`,
  - и дисциплиной использования (пайплайн читает только то, что ему нужно).

Рекомендация реализации:

- уникальность `tag` и single-writer проверяются при сохранении/активации `PipelineProfile` (валидация “нет коллизий”),
- при выполнении шага дополнительно действует runtime-guard: попытка `artifact_write` в чужой `tag` → ошибка policy (защита данных).

### Модель хранения Session (v1): Latest + History

В v1 фиксируем “практическую” модель:

- сессия хранит **актуальное состояние** каждого `art.<tag>` (то, что выдаётся как `art.<tag>.value`);
- история (`art.<tag>.history[]`) хранится **только если** retention политика для этого `tag` её требует.

Концептуально это “Latest + History”:

- **Latest**: материализованное текущее значение `value` для `(ownerId, sessionId, tag)`
- **History**: набор версий (append-only или windowed), управляемый `retentionPolicyJson`

Это позволяет быстро строить `SessionView` и не превращать сессию в “один большой JSON” как источник правды.

### PipelineState как частный случай артефакта (`kind=state`)

**PipelineState** — это артефакт с:

- `kind=state`
- `contentType=json`
- `visibility=prompt_and_ui` (часто) или `ui_only` (если в prompt не надо)
- `uiSurface=panel:*` (часто), но может быть и `chat_history`

Семантика:

- хранит “состояние мира/сессии”: время, локация, активные персонажи, флаги и т.п.
- **не является сообщением** и не хранится в `chat_messages`

### Зависимость от прошлого выполнения

Шаг, обновляющий state (часто post-пайплайн), читает:

- последние \(N\) сообщений (например 5),
- текущий `PipelineState` по тегу (если существует): `art.<tag>.value`,
- при необходимости историю: `art.<tag>.history[]` (в пределах retention),
- при необходимости другие артефакты (например stats/feeds),
- и вычисляет новую версию состояния.

Критично: шаг должен знать, **какую версию** он использовал как базу (`basedOnVersion`), чтобы логировать “до/после”.

### Конфликты обновления persisted-артефактов (v1 минимум)

В v1 фиксируем самое простое и безопасное поведение: **optimistic concurrency + reject**.

- При записи новой версии persisted-артефакта `art.<tag>` шаг указывает `basedOnVersion` (версию, на базе которой вычислял результат).
- Оркестратор применяет запись **только если** текущая `latest` версия по `(ownerId, sessionId, tag)` совпадает с `basedOnVersion`.
- Если `basedOnVersion` не совпал (кто-то успел обновить `latest`, либо произошёл повтор/гонка) — запись отклоняется ошибкой (например `artifact_conflict`).

Auto-retry / merge / last-write-wins — сознательно откладываем на v2+.

### Retention / история артефактов (управляется пользователем)

Пользователь выбирает политику хранения per-tag/per-kind:

- хранить только “последнюю версию” (overwrite),
- хранить историю версий (append-only) в пределах:
  - лимита по количеству версий,
  - TTL по времени,
  - либо обоих ограничений.

В терминах “время жизни” (как ты описал) это удобно нормализовать до трёх режимов:

1. **Ephemeral (одноразовое)**:
   - существует только в рамках одного `PipelineRun` / одной `Generation`
   - типичный пример: pre-CoT `Augmentation`
   - хранение: не как полноценный “долговременный” артефакт, а:
     - либо только в `pipeline_step_runs.outputJson` (redacted/summary/hash),
     - либо в `llm_generations.promptSnapshotJson` (redacted), чтобы дебажить “что реально ушло в prompt”
2. **Windowed (окно по ходам/версиям)**:
   - хранить последние \(N\) версий / \(N\) ходов / TTL
   - в prompt можно включать “последние N результатов” (например последние 5)
   - всё, что старее окна, **не удаляем бесследно**: переносим в архив/снапшот (см. ниже)
3. **Durable (условно “вечно”)**:
   - хранить все версии (или очень большой лимит)
   - типичный пример: бесконечная/длинная лента “reddit-комментариев”

#### Архивирование “старого” (snapshot/архив)

Чтобы “всё старее окна попадает в снепшот” было формализовано, вводим правило:

- при “prune” версий (по window/ttl) система может сохранять:
  - агрегированный снапшот в `pipeline_step_runs.outputJson` (например “сводка старых комментариев”),
  - и/или ссылку на архивные записи (если мы заведём отдельную таблицу `pipeline_artifact_archives` в будущем),
  - и/или просто оставить след в логе шага (какие версии были удалены/сжаты).

> Важно: `llm_generations.promptSnapshotJson` логирует prompt конкретной генерации.  
> Для артефактов “длиннее одного хода” лучше иметь отдельный механизм архива, чтобы не привязывать архив к конкретной генерации.

### “Жизнь в UI” для артефактов, которые живут дольше одного хода

Проблема, которую ты описал (статы): UI не должен показывать 5 старых версий как “актуальные”, но пайплайн должен видеть историю.

Решение: разделить **данные** и **проекцию**.

- **Данные**: версионируемый `PipelineArtifact` (append-only или overwrite+history).
- **UI-проекция** (по умолчанию):
  - для `uiSurface=panel:*` (например `panel:rpg_state`) UI показывает **только последнюю версию** (materialized view),
  - для `uiSurface=feed:*` UI показывает **ленту версий** (timeline),
  - для `uiSurface=chat_history` — либо “вставка” как отдельный элемент истории (если `prompt_and_ui`), либо как UI-only блок.

Это можно описать через поле (логически) `uiPresentationJson`, например:

- `uiPresentation.mode`:
  - `latest_only` (панели/статы)
  - `timeline` (ленты)
  - `diff` (панель “что изменилось”)
- `uiPresentation.maxItems` (для лент)

### “Жизнь в prompt” для артефактов, которые живут дольше одного хода

Аналогично UI, prompt почти никогда не должен включать “всю историю state”.

Рекомендуемая модель выбора версий для prompt:

- `promptInclusion.versionSelector`:
  - `latest` — включать только `art.<tag>.value` (идеально для `kind=state`)
  - `last_n` — включать `art.<tag>.value` + последние \(N-1\) элементов из `art.<tag>.history[]`
  - `all` — включать всё (обычно опасно по токенам; только для небольших артефактов)

Итого, для статов:

- **UI**: `uiPresentation.mode=latest_only`
- **Prompt**: `versionSelector=latest`
- **Pipeline логика**: при обновлении читает `latest` + при необходимости `last_n` (история для вычисления дельт)

### Write policy: артефакты как отдельный write target

Чтобы не ломать инвариант “не переписываем историю чата”, `pipeline_artifacts` является **отдельным write target** с отдельным разрешением:

- `artifact_write` — создание/обновление любых артефактов
- `state_write` — создание/обновление только `kind=state` (более узкое и безопасное)

### Логирование state/artifact update

Рекомендуется писать в `pipeline_step_runs`:

- какой артефакт читали/писали (`tag`, `kind`, `scope`),
- какую версию брали как базу (`basedOnVersion`),
- какая новая версия получилась,
- diff/сводку изменений (не обязательно весь state дублем, если он большой).

