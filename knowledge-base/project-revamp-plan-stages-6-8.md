# Этапы 6-8: Frontend, Legacy Cleanup, SaaS Preparation

Этот документ содержит детальную информацию о **Этапах 6-8** плана переезда TaleSpinner в новое видение (backend-first + DB).

---

## Текущий статус (2026-01-19)

**Этап 6 (frontend: thin UI, cutover на новые API)** — в процессе реализации.

### Этап 6 — прогресс (2026-01-19)

#### ✅ Сделано:

- [x] **Cutover chat UI на backend-first core API**

  - UI работает от `EntityProfile -> Chat -> Messages` через новые endpoint'ы: `/entity-profiles`, `/entity-profiles/:id/chats`, `/chats/:id/messages`
  - отправка сообщений и стриминг: `POST /chats/:id/messages` + `Accept: text/event-stream`
  - abort генерации: `POST /generations/:id/abort`

- [x] **Убрана клиентская сборка prompt**

  - не используется `buildMessages()` и template prepend на фронте; prompt собирается на сервере (оркестратор + LiquidJS)

- [x] **Починены "legacy settings" блокирующие запуск фронта**

  - добавлен `GET/POST /settings/pipelines` (иначе UI падал на 404 HTML → JSON parse)
  - фронтовые `_fabric_` модели теперь устойчивее к не-JSON ошибочным ответам

- [x] **Templates UI подключён к DB-first prompt_templates (совместимость)**

  - legacy UI `/templates` и `/settings/templates` теперь работают поверх таблицы `prompt_templates` (scope=global)
  - выбранный global template реально влияет на следующие генерации (через pickActivePromptTemplate)

- [x] **Variants/swipes и управление ими (UI + API)**
  - добавлены core endpoint'ы:
    - `GET /messages/:id/variants`
    - `POST /messages/:id/variants/:variantId/select`
    - `POST /messages/:id/regenerate` (`Accept: text/event-stream`)
  - UI: добавлены swipe-контролы для **последнего assistant сообщения** (select variant + regenerate)
  - v1 ограничения:
    - regenerate разрешён только для **последнего сообщения** в ветке (упрощение семантики)
    - в `llm.stream.meta` для regenerate `userMessageId=null`

#### ❌ Осталось по Этапу 6 (крупные хвосты):

- [ ] **Сообщения: edit/delete (и/или manual_edit variant)**
- [ ] **Мульти-чат UX у профиля**
  - список чатов у `EntityProfile`, создание/удаление чатов, переключение активного чата
- [ ] **Branches UI**
  - список/создание/activate веток, корректный показ истории по выбранной ветке
- [ ] **Templates UI v1 "по-новому"**
  - перейти с legacy `/templates` на `/prompt-templates` и добавить scope (global/entity_profile/chat)
- [ ] **Pipeline UI**
  - привести UI пайплайнов к DB-first модели `/pipelines` (и убрать legacy ожидания, если есть)

---

## Этап 6. Frontend: превратить в "тонкий UI"

### 6.1 Убрать frontend-сборку prompt и "источник правды"

**Статус:** ✅ **Выполнено**

Перевести на backend-first:

- ✅ убрать сбор `GenerateMessage[]` на фронте (`buildMessages`, template prepend на клиенте)
- ✅ `$currentAgentCard` и автосейв "каждые 1s" заменить на:
  - загрузку из API (chat/messages)
  - локальное UI-состояние (input, selection, pending)

### 6.2 Подключить новые сущности

**Статус:** ✅ **Частично выполнено**

Заменить UI-терминологию/модели:

- ✅ `AgentCard` → `EntityProfile`
- ✅ список чатов у профиля: `EntityProfile -> Chats`
- ✅ внутри чата показывать сообщения по ветке + variants/swipes

### 6.3 Streaming

**Статус:** ✅ **Выполнено**

Фронт должен:

- ✅ отправлять `POST /chats/:id/messages` с `Accept: text/event-stream`
- ✅ рендерить чанки как "typing"
- ✅ корректно обрабатывать abort (по generationId)

### 6.4 Мульти-чат UX у `EntityProfile`

**Статус:** ❌ **Не выполнено**

Цель: профиль — это "контейнер чатов", а не "один чат навсегда".

**Требуется реализовать:**

- UI:
  - список чатов профиля (`GET /entity-profiles/:id/chats`)
  - создание чата (`POST /entity-profiles/:id/chats`) и авто-переход в него
  - soft-delete чата (`DELETE /chats/:id`) + скрытие "deleted" по умолчанию
  - запоминание "активного чата" (в роуте/URL, либо в UI state)

**Критерий готовности:**

- можно быстро создать 2–3 чата у одного профиля и переключаться без потери истории/контекста.

### 6.5 Branches UI (ветки)

**Статус:** ❌ **Не выполнено**

Цель: показывать историю **только выбранной ветки** и управлять ветками как first-class сущностью.

**Требуется реализовать:**

- UI:
  - список веток (`GET /chats/:id/branches`)
  - создание ветки (`POST /chats/:id/branches`) с понятным "fork point" (по спеке)
  - активация ветки (`POST /chats/:id/branches/:branchId/activate`)
  - подгрузка сообщений выбранной ветки (`GET /chats/:id/messages?branchId=...`)
- UX:
  - ветка по умолчанию — `main`
  - видимый индикатор активной ветки в заголовке чата

**Критерий готовности:**

- переключение ветки меняет ленту сообщений, и отправка нового сообщения пишет в активную ветку.

### 6.6 Variants / Swipes (варианты ответа)

**Статус:** ✅ **Выполнено (v1)**

Цель: для каждого assistant сообщения уметь хранить и переключать варианты, а также регенерировать новый вариант без разрушения истории.

**Реализовано (v1):**

- UI:
  - swipe-контролы на **последнем** assistant сообщении:
    - select variant (влево/вправо)
    - regenerate (на последнем варианте → создаёт новый)
- API:
  - `GET /messages/:id/variants`
  - `POST /messages/:id/variants/:variantId/select`
  - `POST /messages/:id/regenerate` (`Accept: text/event-stream`)
- Репозиторий/файлы (для навигации по коду):
  - `server/src/services/chat-core/message-variants-repository.ts`
  - `server/src/api/message-variants.core.api.ts`
  - `web/src/api/chat-core.ts`
  - `web/src/model/chat-core/index.ts`
  - `web/src/features/chat-window/message/variant-controls.tsx`
- v1 ограничения:
  - regenerate разрешён только для **последнего** сообщения в ветке
  - UI подключён только для **последнего** assistant сообщения (можно расширить на любое сообщение позже)

**Критерий готовности (выполнен в рамках v1):**

- регенерация создаёт новый variant у **того же** assistant message, swipe переключает варианты, selected сохраняется в БД и переживает reload.

### 6.7 Edit/Delete сообщений (или manual_edit через variant)

**Статус:** ❌ **Не выполнено**

Цель: позволить исправлять историю, не ломая модель "вариантов".

**Требуется реализовать:**

Рекомендуемый путь v1 (минимум и совместимо с variants):

- **manual_edit**: редактирование делаем как создание нового `message_variant` с меткой/источником `manual_edit` и автоселекцией.
  - API: `POST /messages/:id/variants` с `{ promptText }` + auto-select
- **delete**: soft-delete `chat_message` (и скрывать по умолчанию в UI).
  - API: `DELETE /messages/:id` (или `POST /messages/:id:delete`)

**Критерий готовности:**

- можно поправить последнее assistant сообщение вручную (создаётся variant), можно удалить произвольное сообщение, UI корректно пересчитывает ленту.

### 6.8 Templates UI v1 (DB-first, scopes)

**Статус:** ❌ **Не выполнено** (частично: legacy UI работает поверх DB, но без scopes)

Цель: уйти от legacy `/templates` и дать полноценный редактор prompt templates с областями применения.

**Требуется реализовать:**

- UI:
  - список/создание/редактирование/удаление шаблонов через `/prompt-templates`
  - выбор scope: `global`, `entity_profile`, `chat` (и `scopeId` где нужно)
  - включение/выключение (enabled) и понятная логика "активного" шаблона
  - простая превью/валидация LiquidJS (как минимум: проверка "template compiles" на сохранении)

**Критерий готовности:**

- можно назначить шаблон на чат (переопределяет профиль/глобальный), и следующий ответ реально рендерится через него.

### 6.9 Pipeline UI (DB-first)

**Статус:** ❌ **Не выполнено**

Цель: UI пайплайнов должен работать поверх `/pipelines` (таблица `pipelines`) без любых JSON-legacy ожиданий.

**Требуется реализовать:**

- UI:
  - список/CRUD pipelines через `/pipelines`
  - редактирование `definitionJson` (как JSON editor) + базовая валидация
  - (опционально) debug: показать `pipeline_run_id` текущей генерации и список последних run'ов/step'ов по чату

**Критерий готовности:**

- пайплайны редактируются и сохраняются в БД; UI не падает, если есть новые поля в `definitionJson`.

### 6.10 Definition of Done (Этап 6)

Этап 6 считаем завершённым, когда:

- [x] **Chat UI полностью backend-first**: нет client-side сборки prompt, нет "канонического" состояния истории на фронте.
- [ ] **EntityProfile → multi-chat**: list/create/switch/delete чатов работает.
- [ ] **Branches**: list/create/activate + корректный рендер выбранной ветки.
- [x] **Variants**: swipe/select + regenerate как новый variant (без создания "лишнего" user сообщения).
- [ ] **Edit/Delete**: manual_edit через variant и soft-delete сообщения.
- [ ] **Templates**: UI работает через `/prompt-templates` и поддерживает scopes.
- [ ] **Pipelines**: UI работает через `/pipelines` (DB-first).
- [ ] **Нет обращений к legacy endpoints** для chat/templates/pipelines в основных пользовательских сценариях.

**Минимальный smoke-чеклист:**

- создать профиль → создать 2 чата → отправить сообщение в каждый → перезагрузить страницу → история сохранена
- создать ветку → активировать → отправить сообщение → вернуться в main → истории не смешались
- сделать regenerate варианта → переключить swipe → selected переживает reload
- отредактировать ответ (manual_edit variant) → текст обновился, оригинал доступен как "другой вариант"
- назначить chat-level template → следующий ответ формируется по нему

---

## Этап 7. Удаление legacy и чистка

**Статус:** ❌ **Не начат**

**Требуется выполнить:**

Удалить/выключить:

- файловое JSON-хранилище (`server/src/core/services/base-service.ts`, `config-service.ts`) или оставить только для не-чатовых legacy частей, если они ещё нужны
- legacy API вокруг `agent-cards` и /или `/chats` если больше не используются:
  - `server/src/services/agent-cards.service.ts`
  - `server/src/api/agent-cards.api.ts`
  - `server/src/routes/chat-routes.ts` (если перейдём полностью на новое)
- frontend fabric модели, которые больше не применимы к chat history (в частности "сохранение карточки целиком")

**Артефакт готовности:**

- никакие данные чата не пишутся в JSON на диск; всё в БД.

---

## Этап 8. Закладка под SaaS (без реализации)

**Статус:** ❌ **Не начат** (планирование)

**Требуется подготовить (без реализации auth):**

- единый `ownerId` (все таблицы), индексы по нему
- отсутствие "глобальных" синглтонов в бизнес-логике (scope-aware runtime)

**Примечание:** Это подготовительный этап для будущей мультитенантности. Реализация аутентификации и авторизации не входит в текущий план.

---

## Статус реализации (факт)

### Сделано:

- ✅ отправка/стриминг/abort через backend-first core API (SSE)
- ✅ UI больше не собирает prompt (нет client-side template prepend / buildMessages)
- ✅ variants/swipes: list/select/regenerate (DB-first) + UI-контролы для последнего assistant сообщения

### Осталось:

- ❌ мульти-чат UX у профиля (list/create/switch/delete)
- ❌ branches UX (list/create/activate + рендер истории выбранной ветки)
- ❌ edit/delete сообщений (или "manual_edit" через variant)
- ❌ templates UI v1 через `/prompt-templates` + scopes (global/entity_profile/chat)
- ❌ pipeline UI: перевести на DB-first `/pipelines` и (опц.) debug-панель runs
- ❌ финальная чистка legacy моделей/страниц на фронте (подготовка к Этапу 7)
