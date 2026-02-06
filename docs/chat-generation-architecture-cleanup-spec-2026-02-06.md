# Spec: Приведение Архитектуры Генерации В Порядок (v2)

_Дата: 2026-02-06 (draft)_

## 1) Зачем этот документ

Текущая реализация генерации и operation-profile логики уже создает существенный техдолг:
- фазы `before_main_llm` и `after_main_llm` запускаются из разных мест;
- ответственность размазана между `prompt-draft-builder`, `chat-core/orchestrator` и `template-operations-runtime`;
- сложно понять единый lifecycle запроса и гарантии порядка;
- поддержка и расширение `kind=template` и следующих kind-ов станет все дороже.

Цель: зафиксировать простую, поддерживаемую архитектуру до релиза в прод.

## 2) Цели

- Один понятный orchestrator flow: `before -> main_llm -> after`.
- Одна точка входа в генерацию чата.
- Явные границы между фазами и между `execute`/`commit`.
- Детерминированный результат независимо от `concurrent/sequential`.
- Минимальная когнитивная нагрузка на поддержку.

## 3) Не-цели

- Полный рефактор всех UI форм operation profile.
- Полная реализация всех operation kind в этом цикле.
- Полная переработка storage-модели артефактов за один шаг.

## 4) Принципы архитектуры

- Single entrypoint: только один сервис управляет всеми фазами генерации.
- Phase-oriented design: каждая фаза изолирована и тестируется отдельно.
- Pure builder: сборка prompt-драфта не выполняет бизнес-side-effects операций.
- Execute/Commit split: операции вычисляют effect-draft, коммит централизован.
- Deterministic commit order: `dependsOn -> order -> opId`.
- Observable by default: каждая фаза дает machine-readable report.

## 5) Целевая модель (To-Be)

## 5.1 Единый lifecycle

`runChatGenerationV2` выполняет строго:
1. `prepare`: загрузка контекста и профиля.
2. `build_base_prompt`: сбор базового draft без operation effects.
3. `run_before_phase`: execute операций hook=`before_main_llm`.
4. `commit_before_phase`: применение prompt/artifacts эффектов.
5. `barrier_before`: проверка required before; при fail main LLM не стартует.
6. `run_main_llm`: вызов `streamGlobalChat` и стрим чанков.
7. `run_after_phase`: execute операций hook=`after_main_llm`.
8. `commit_after_phase`: применение turn/artifacts эффектов.
9. `persist_finalize`: финальный flush, статус, отчеты.

## 5.2 Единый RunState

Весь flow работает через один state-объект:
- `draftMessages`
- `llmMessages`
- `assistantText`
- `artifacts`
- `phaseReports`
- `operationReports`
- `promptHash/promptSnapshot`

Ни одна фаза не должна пересобирать этот state «с нуля».

## 5.3 Границы модулей

Предлагаемая структура:

`server/src/services/chat-generation/`
- `run-chat-generation-v2.ts` — единый phase orchestrator
- `contracts.ts` — RunState, PhaseResult, CommitReport
- `phases/prepare.ts`
- `phases/build-base-prompt.ts`
- `phases/run-operations-phase.ts`
- `phases/commit-effects-phase.ts`
- `phases/run-main-llm-phase.ts`
- `phases/persist-finalize.ts`

`server/src/services/operations/`
- `template-operation-executor.ts` — только execute, без мутации канона
- `effect-commit.ts` — centralized commit policy

`server/src/services/chat-core/`
- сохранить API-слой и старые адаптеры на период миграции;
- после cutover оставить thin-adapter к `runChatGenerationV2`.

## 6) Что меняем в текущем коде

## 6.1 Убираем размазывание фаз

Изменение:
- `before_main_llm` больше не запускается из `prompt-draft-builder`.
- `prompt-draft-builder` становится pure function: только история + system + normalize.
- обе фазы операций вызываются только из `runChatGenerationV2`.

## 6.2 Убираем `applyTemplateOperationsX` раздвоение

Вместо двух внешних функций:
- `applyTemplateOperationsToPromptDraft`
- `applyTemplateOperationsAfterMainLlm`

Вводим:
- `runOperationsPhase({ hook, runState, profile, trigger, context })`

И отдельный шаг:
- `commitEffectsPhase({ hook, runState, effectDrafts })`

## 6.3 Единая policy-валидация

Save-time:
- запрет `prompt_time` при `after_main_llm`
- запрет `turn.assistant` при `before_main_llm`
- compile-check template syntax

Run-time:
- повторная policy guard перед commit (defense in depth)
- bounded payload checks для prompt injections

## 7) Контракт фазы операций (минимум)

`runOperationsPhase` возвращает:
- `taskResults`
- `effectDrafts`
- `requiredFailures`
- `phaseStatus`

`commitEffectsPhase` возвращает:
- `applied[]`
- `skipped[]`
- `errors[]`
- `commitStatus`

Main orchestrator принимает решения о continuation/fail только на этих результатах.

## 8) План миграции

## Этап A: Foundations
- добавить `RunState`/`PhaseResult` контракты;
- добавить интеграционные тесты текущего поведения.

Критерий:
- есть тестовый baseline `before -> llm -> after`.

## Этап B: Pure Prompt Builder
- удалить вызов template operations из `prompt-draft-builder`;
- оставить builder без side-effects.

Критерий:
- сборка draft не зависит от operation profile runtime.

## Этап C: Single Phase Orchestrator
- реализовать `runChatGenerationV2` с обеими фазами;
- подключить `streamGlobalChat` внутри единого lifecycle.

Критерий:
- один entrypoint управляет всеми фазами.

## Этап D: Execute/Commit Split
- вынести commit из `task.run`;
- применять эффекты централизованно и детерминированно.

Критерий:
- одинаковый результат при повторных запусках в `concurrent`.

## Этап E: Cutover и Cleanup
- переключить API endpoints на V2 entrypoint;
- удалить временные adapters/legacy pathways.

Критерий:
- старый путь не участвует в production flow.

## 9) Критерии готовности (DoD)

- D1: В коде ровно одна точка orchestration фаз генерации.
- D2: `before_main_llm` и `after_main_llm` не вызываются из разных подсистем.
- D3: `prompt-draft-builder` не содержит operation runtime вызовов.
- D4: commit эффектов детерминирован и покрыт тестами.
- D5: по каждому run есть phase/commit report.
- D6: документация и код совпадают по lifecycle.

## 10) Риски

- Риск: сломать обратную совместимость prompt hash/snapshot.
- Риск: скрытые зависимости от текущего недетерминированного поведения.
- Риск: рост объема изменений в одном PR.

Снижение:
- миграция по этапам;
- V2 entrypoint включается напрямую как основной путь;
- контракты и тесты до и после каждого этапа.

## 11) Открытые решения

- Где хранить commit reports: в БД или только runtime logs?
- Нужно ли жестко ограничить `concurrent` для мутационных эффектов до полного commit слоя?
- Нужен ли отдельный API для debug-просмотра phase reports в UI?
- Должен ли `after_main_llm` required-failure менять пользовательский статус generation?

## 12) Затрагиваемые файлы (первый проход)

- `server/src/services/chat-core/orchestrator.ts`
- `server/src/services/chat-core/prompt-draft-builder.ts`
- `server/src/services/operations/template-operations-runtime.ts`
- `server/src/services/operations/operation-profile-validator.ts`
- `shared/types/operation-profiles.ts`
