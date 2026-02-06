# Spec: План Работ По `kind=template`, Orchestrator И Prompt Effects

_Дата: 2026-02-06 (draft для обсуждения)_

## 1) Контекст

Цель документа: зафиксировать рабочий план эволюции `template`-операций, их влияния на prompt/output и правил применения инъекций в оркестраторе.

Текущее поведение в коде:
- `before_main_llm` для template операций выполняется в `server/src/services/chat-core/prompt-draft-builder.ts`.
- `after_main_llm` для template операций выполняется в `server/src/services/chat-core/orchestrator.ts`.
- Применение эффектов происходит inline во время `task.run` в `server/src/services/operations/template-operations-runtime.ts`.
- Профиль может работать в `executionMode="concurrent"`, что при inline side-effects создает недетерминизм порядка коммита.

## 2) Проблема

Ключевые риски текущей реализации:
- Недетерминизм итогового prompt/artifacts при конкурентном выполнении операций.
- Отсутствие явной границы `execute -> commit` для эффектов.
- Политики hook-ограничений не полностью валидируются на save-time.
- `artifacts` пока существуют в основном как run-memory и слабо влияют на дальнейшие фазы.
- Недостаточная наблюдаемость: сложно объяснить, какой output реально попал в prompt и почему.

## 3) Целевое Состояние (To-Be)

Инварианты целевой модели:
- `execute` и `commit` разделены.
- Коммит эффектов детерминирован: `dependsOn -> order -> opId`.
- Hook-policy валидируется заранее и в runtime.
- Prompt injections управляются едиными правилами ролей, лимитов и источников.
- Результаты применения эффектов фиксируются в commit-report и доступны для диагностики.

## 4) Scope / Non-Goals

Что входит в план:
- Рефактор runtime template-операций.
- Валидация профиля для `prompt_time` и `turn_canonicalization`.
- Минимальная модель commit-report и runtime observability.
- Уточнение правил prompt injection.

Что не входит в план:
- Полная реализация `llm/rag/tool/compute/transform` рантаймов.
- Полный redesign Operation Profile UI.
- Миграция старого pipeline-слоя в этом цикле.

## 5) План Внедрения (по этапам)

### Этап 0: Baseline и Safety Net

Задачи:
- Добавить интеграционные тесты на последовательность применения эффектов `before_main_llm` и `after_main_llm`.
- Зафиксировать текущие edge-cases: required failure, ignored prompt-time after main LLM, assistant canonicalization in wrong hook.

Критерий готовности:
- Есть тесты, которые воспроизводят текущие контракты и защищают от регрессий при рефакторинге.

### Этап 1: Разделение `execute -> commit` для template runtime

Задачи:
- В `template-operations-runtime` перестать мутировать `state` внутри `task.run`.
- Внутри `run` собирать `effect drafts` и `rendered output`.
- После завершения оркестратора применять drafts в детерминированном порядке.
- Сохранить логику required-операций: required non-done останавливает соответствующий hook flow.

Критерий готовности:
- Результат одинаков при повторных запусках с одинаковым входом в `concurrent` режиме.

### Этап 2: Policy/Validation Hardening

Задачи:
- Добавить save-time правило: `prompt_time` запрещен при `hook=after_main_llm`.
- Добавить save-time правило: `turn_canonicalization.target="assistant"` запрещен при `hook=before_main_llm`.
- Добавить compile-check для `template` (Liquid syntax) при сохранении профиля.

Критерий готовности:
- Некорректные комбинации не сохраняются, ошибки понятны и стабильны.

### Этап 3: Артефакты и Межфазная Передача Состояния

Задачи:
- Протащить `before_main_llm` artifacts в `after_main_llm` runtime context текущего run.
- Начать учитывать `output.writeArtifact` не только как `tag`, но и как policy-метаданные (`persistence`, `usage`, `semantics`).
- Согласовать минимальные правила для `run_only` и `persisted`.

Критерий готовности:
- Операция `after_main_llm` может читать артефакты, созданные до main LLM в том же run.

### Этап 4: Prompt Injection Policy и Observability

Задачи:
- Ввести runtime-policy для инъекций: разрешенные роли, ограничения длины, нормализация разделителей.
- Использовать `promptTime.source` в commit-report.
- Логировать итоговый applied-set эффектов без чувствительных данных.

Критерий готовности:
- Для каждого run можно ответить: какая операция что сгенерировала, что было применено, что было отклонено и по какой причине.

## 6) Предлагаемый Формат Релизов

Рекомендуемая нарезка:
- PR1: этап 0 + каркас commit-draft контрактов.
- PR2: этап 1 (execute/commit separation).
- PR3: этап 2 (validator + compile-check).
- PR4: этап 3 (artifacts flow).
- PR5: этап 4 (policy + observability + docs).

## 7) Критерии Готовности Всего Цикла (DoD)

- D1: Детерминированный commit эффектов в `concurrent`.
- D2: Явные policy-ошибки для недопустимых hook/output комбинаций.
- D3: Межфазная доступность run-артефактов.
- D4: Commit-report с трассировкой applied/skipped/error.
- D5: Обновленная документация по runtime контракту `template kind`.

## 8) Риски и Снижение Рисков

Риски:
- Ломка текущих профилей с невалидными комбинациями.
- Скрытые зависимости от недетерминированного поведения.
- Увеличение сложности runtime кода.

Митигейшн:
- Мягкая миграция с backward-compatible fallback на этапе включения валидации.
- Feature-flag на новый commit-путь.
- Обязательные интеграционные тесты на критические сценарии.

## 9) Вопросы Для Обсуждения

- Нужен ли strict режим по умолчанию для prompt injections или только для отдельных профилей?
- Блокировать ли `concurrent` режим, если в профиле есть мутационные prompt/turn эффекты, или оставить через commit-очередь?
- Где хранить commit-report: только в логах run или в отдельной таблице для UI дебага?
- Должен ли `after_main_llm` required failure менять финальный пользовательский статус generation в API?

## 10) Затрагиваемые Файлы (ориентир)

- `server/src/services/operations/template-operations-runtime.ts`
- `server/src/services/operations/template-operations-runtime.test.ts`
- `server/src/services/operations/operation-profile-validator.ts`
- `server/src/services/chat-core/prompt-draft-builder.ts`
- `server/src/services/chat-core/orchestrator.ts`
- `shared/types/operation-profiles.ts`
- `web/src/features/sidebars/operation-profiles/ui/operation-editor/sections/output-section.tsx`
