# Фаза 4 — Артефакты: `pipeline_artifacts`, SessionView и `art.<tag>`

Цель: внедрить `PipelineArtifact` как first-class сущность для:

- prompt-only вставок (augmentation),
- ui-only контента (feeds/panels),
- долговременного состояния (PipelineState),
- детерминированной композиции влияний нескольких пайплайнов на effective prompt.

## Ссылки на спеку

- База и мотивация: `../pipelines-and-processing-spec/40-artifacts.md`
- Mutation policy / write targets / single-writer: `../pipelines-and-processing-spec/20-mutation-policy.md`
- Execution model / ordering: `../pipelines-and-processing-spec/10-execution-model.md`

## Что делаем

### F4.1 — Storage по модели Latest + History

Минимальные свойства persisted-артефакта:

- ключ: `(ownerId, sessionId=chatId, tag)` (уникальность `tag` в рамках чата)
- `kind`, `access=persisted`, `visibility`, `uiSurface`, `contentType`, `contentJson/contentText`
- версия: `version` + `basedOnVersion`
- retention policy (минимум: `overwrite` vs `keep_last_n`)

Нефункциональные требования:

- быстрый запрос “latest по tag”
- bounded рост истории (N/TTL)

### F4.2 — `SessionView` и Liquid доступ

`SessionView` строится из persisted-артефактов чата и даёт:

- `art.<tag>.value` — актуальное значение (json/text)
- `art.<tag>.history[]` — предыдущие значения (без текущего)

### F4.3 — Policy: single-writer + runtime guard + validation на профиле

Правило v1:

- у каждого persisted `tag` ровно один writer (пайплайн-владелец)
- запись в “чужой” tag → `policy_error`

Валидация при активации/сохранении профиля:

- нет коллизий persisted `tag` между активными пайплайнами
- ownership зафиксирован и проверяется на рантайме

### F4.4 — `promptInclusion` (минимум v1) + детерминированный порядок

Минимальный набор способов включения:

- `prepend_system`
- `append_after_last_user` (ключевой кейс augmentation)
- `as_message` (роль задаётся)
- `none`

Порядок включения (tie-break v1):

1. порядок пайплайна в `PipelineProfile`
2. порядок шагов внутри пайплайна
3. `tag` (лексикографически)
4. `version`/`id`

### F4.5 — UI поверхности (минимум)

Минимальный фронтовый/серверный контракт:

- `uiSurface=panel:*` — показывает **latest_only**
- `uiSurface=feed:*` — показывает **timeline** (последние N версий)

## Критерии готовности

- Можно создать persisted артефакт `art.<tag>` и обновлять его версионированно с `basedOnVersion`.
- Конфликт версий даёт предсказуемую ошибку (`artifact_conflict`), без last-write-wins.
- Liquid доступ `art.<tag>.value/history` работает и используется в шаблонах.
- `promptInclusion` реально влияет на PromptDraft и даёт детерминированный порядок.
- UI может отображать хотя бы одну панель (`panel:*`) и одну ленту (`feed:*`) на данных артефактов.

