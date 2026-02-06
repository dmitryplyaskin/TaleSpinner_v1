# Spec: Chat Generation Architecture v3 (Run-Centric + Deterministic Commit)

_Дата: 2026-02-06 (draft)_

## 1) Статус и приоритет документов

Этот документ задает целевую архитектуру генерации для текущего кода `chat-core` и заменяет `docs/chat-generation-architecture-cleanup-spec-2026-02-06.md`.

Нормативная база:
- `docs/pipelines-and-processing-spec-v2/*` — концептуальная база (термины, hooks, run, effects, commit).
- Этот документ — implementation contract для текущего репозитория.

Правило приоритета:
- При конфликте между legacy-v2 описанием и текущими ограничениями кода приоритет у этого документа.
- После внедрения v3 несоответствия должны быть обратно синхронизированы в `pipelines-and-processing-spec-v2`.

## 2) Диагностика текущей архитектуры (As-Is)

Подтвержденные проблемы по коду:

1. Фазы генерации размазаны между модулями.
- `before_main_llm` запускается в `server/src/services/chat-core/prompt-draft-builder.ts`.
- `after_main_llm` запускается в `server/src/services/chat-core/orchestrator.ts`.

2. Нет единого run-snapshot профиля.
- Профиль читается минимум дважды в разных фазах (`buildPromptDraft` и `runChatGeneration`), что допускает смену `activeProfileId` в середине одного пользовательского run.

3. Нет разделения execute/commit.
- В `server/src/services/operations/template-operations-runtime.ts` эффекты применяются inline в `task.run` (`applyOperationOutput`), а не через отдельный commit-слой.

4. Недетерминизм в `executionMode="concurrent"`.
- Конкурентные задачи мутируют общий `RuntimeState` (`messages/art/assistantText`) в момент выполнения, а не после deterministic commit.

5. Межфазные артефакты теряются.
- `before_main_llm` и `after_main_llm` создают отдельные `state.art`; результаты `before` недоступны в `after` в рамках того же run.

6. Hook-policy неполная.
- Невалидные комбинации (`prompt_time` в `after_main_llm`, `assistant canonicalization` в `before_main_llm`) сейчас в основном молча игнорируются runtime-ом, а не блокируются save-time.

7. Отсутствует полноценная модель `OperationProfileSession`/artifact store.
- `operationProfileSessionId` хранится в профиле, но нет runtime-хранилища persisted/run_only артефактов по session key.

8. Вход в генерацию фактически дублируется в API.
- `chats.core.api.ts`, `chat-entries.api.ts`, `message-variants.core.api.ts` дублируют сбор system prompt + build prompt + запуск оркестратора.

9. Наблюдаемость ограничена.
- SSE отдает только `llm.stream.*`; нет фазовых/операционных/commit событий и commit-report.

10. Scope активного профиля глобальный.
- `operation_profile_settings` использует row `id="global"`, без owner/chat/branch scoping.

## 3) Цели v3

- Один orchestration entrypoint для полного lifecycle `before -> main_llm -> after`.
- Freeze входа run: профиль/политики/контекст фиксируются один раз до старта фаз.
- Жесткое разделение `execute` и `commit`.
- Детерминированный результат при `sequential` и `concurrent`.
- Явные hook-policy и defense-in-depth валидация (save-time + run-time).
- Наблюдаемость каждого шага run (phase, operation, commit).

## 4) Не-цели v3

- Полная реализация всех operation kind (`llm/rag/tool/compute/transform`) в одном цикле.
- Полный редизайн UI редактора профилей.
- Миграция всех legacy endpoint-ов за один PR.

## 5) Целевая модель (To-Be)

### 5.1 Единый entrypoint

Вводится сервис:
- `runChatGenerationV3(request): AsyncGenerator<RunEvent>`

Он единолично управляет:
- подготовкой run context;
- обеими operation phase;
- main LLM;
- commit эффектов;
- persistence и финализацией.

API-роуты становятся thin adapters: только преобразуют HTTP/SSE в `RunRequest` и прокидывают события наружу.

### 5.2 RunContext (immutable snapshot)

`RunContext` фиксируется один раз в начале:
- `runId`, `generationId`, `trigger`, `chatId`, `branchId`, `turn refs`;
- `profileSnapshot` (id/version/executionMode/operations/settings);
- `promptTemplateSnapshot`;
- `runtimeInfo` (provider/model/settings);
- `policySnapshot` (лимиты, role restrictions, debug flags);
- `sessionKey` (`chatId + branchId + profileRef + operationProfileSessionId`).

Запрещено повторно читать active profile внутри фаз.

### 5.3 RunState (mutable, единый)

Единое состояние на весь lifecycle:
- `basePromptDraft`;
- `effectivePromptDraft`;
- `llmMessages`;
- `assistantText`;
- `runArtifacts` (run_only);
- `persistedArtifactsSnapshot` (session read model);
- `operationResultsByHook`;
- `commitReportsByHook`;
- `phaseReports`;
- `promptHash`, `promptSnapshot`.

Ни одна фаза не пересобирает state с нуля.

### 5.4 Lifecycle фаз (нормативно)

`runChatGenerationV3` выполняет строго:

1. `prepare_run_context`
- Валидация входа, freeze snapshot, load profile/session.

2. `build_base_prompt`
- Pure сборка system + history без operation side effects.

3. `execute_before_operations`
- Запуск before-операций через core DAG orchestrator.
- Выход: только `OperationResult[]` с `effects[]`, без мутаций канона.

4. `commit_before_effects`
- Применение `done`-операций в deterministic порядке.
- Обновление `effectivePromptDraft`, run/persisted artifacts, user turn edits (если разрешены policy).

5. `before_barrier`
- Required-before не `done` или commit-error required-before => `failedType=before_barrier`, main LLM не стартует.

6. `run_main_llm`
- Ровно один вызов main LLM по `effectivePromptDraft`.
- Стрим chunk-ов и flush assistant текста.

7. `execute_after_operations`
- Запуск after-операций (контекст включает finalized assistant output + artifacts from before).

8. `commit_after_effects`
- Commit turn/artifact эффектов after-фазы.
- Любой `prompt.*` тут = policy error.

9. `persist_finalize`
- Финальный flush, generation status, run report, commit report.

### 5.5 Execute/Commit контракт

`executeOperation`:
- может делать compute/llm/tool внутри blackbox;
- не имеет права менять prompt/turn/artifacts напрямую;
- возвращает:
  - `status: done|skipped|error|aborted`
  - `effects: Effect[]`
  - `debug summary` (bounded)
  - `error` (stable code/message)

`commitEffects`:
- применяет эффекты только операций со `status="done"`;
- использует deterministic order: `dependsOn -> order -> opId`;
- делает policy checks по hook и bounded checks;
- возвращает `CommitReport`.

### 5.6 Policy матрица по hook

`before_main_llm`:
- разрешено: `prompt.*`, `artifact.*`, `turn.user.*`.
- запрещено: `turn.assistant.*`.

`after_main_llm`:
- разрешено: `turn.user.*`, `turn.assistant.*`, `artifact.*`.
- запрещено: `prompt.*`.

Нарушение policy:
- для required операции -> `commit error` влияет на run status;
- для optional -> фиксируется в report, run может продолжаться.

### 5.7 Артефакты и session

Вводится двухслойное хранилище:
- `RunArtifactStore` (run_only, in-memory per run);
- `ProfileSessionArtifactStore` (persisted по `sessionKey`).

Требования:
- `run_only` живет только в рамках текущего run;
- `persisted` доступен между run;
- оба слоя читаются через единый facade `art.<tag>.value`;
- эффекты `before` доступны в `after` в рамках того же run.

### 5.8 Наблюдаемость

Минимальные события v3:
- `run.started`
- `run.phase_changed`
- `operation.started`
- `operation.finished`
- `commit.effect_applied|skipped|error`
- `main_llm.started|delta|finished`
- `run.finished`

Каждое событие имеет `runId` и `seq` (монотонный в рамках run).

## 6) Save-time валидация профиля (усиление)

Добавить к текущим проверкам:

1. Hook/output compatibility:
- `prompt_time` запрещен, если операция имеет только `after_main_llm` hook.
- `turn_canonicalization.target="assistant"` запрещен, если операция имеет только `before_main_llm` hook.

2. Cross-hook dependency guard:
- `dependsOn` не должен формировать обязательность между hook-группами в одном запуске фазы.

3. Template compile-check:
- `params.template` компилируется `validateLiquidTemplate(...)` при save/import.

4. Existing checks сохранить:
- уникальность `opId`;
- unknown/self/cycle в `dependsOn`;
- duplicate artifact tag в профиле.

## 7) Reconciliation с legacy v2

Приняты без изменений:
- два hook: `before_main_llm` / `after_main_llm`;
- два trigger: `generate` / `regenerate`;
- done-only commit;
- deterministic commit order;
- barrier перед main LLM.

Адаптировано для текущего кода:
- пока идентификатор операции — `opId` (UUID), не `operationId` из внешнего каталога;
- `OperationDefinition` каталог может быть добавлен позже отдельным слоем;
- v3 вводит строгий snapshot-механизм и единый entrypoint раньше полного перехода на всю модель v2.

## 8) Целевая структура модулей

`server/src/services/chat-generation-v3/`
- `run-chat-generation-v3.ts` (главный orchestrator)
- `contracts.ts` (`RunContext`, `RunState`, `RunEvent`, `RunResult`)
- `prepare/resolve-run-context.ts`
- `prompt/build-base-prompt.ts`
- `operations/execute-operations-phase.ts`
- `operations/commit-effects-phase.ts`
- `operations/effect-policy.ts`
- `operations/effect-handlers/*`
- `artifacts/run-artifact-store.ts`
- `artifacts/profile-session-artifact-store.ts`
- `main-llm/run-main-llm-phase.ts`
- `persist/finalize-run.ts`

`server/src/services/chat-core/`
- оставить adapter слой для совместимости API;
- `orchestrator.ts` после cutover -> thin wrapper или удаление.

## 9) План миграции

### Этап A: Baseline и freeze-контракт
- Добавить интеграционные тесты текущего поведения before/main/after.
- Зафиксировать expected SSE + generation statuses.

### Этап B: Новый v3 каркас без cutover
- Ввести `RunContext`/`RunState`/phase contracts.
- Подключить read-only режим (без прод включения).

### Этап C: Execute/Commit split
- Переписать template runtime: `task.run` возвращает effect drafts.
- Добавить deterministic commit слой.

### Этап D: Session artifacts
- Ввести run_only + persisted stores и session key.
- Протащить before artifacts в after фазу.

### Этап E: Validator hardening
- Hook/output checks + Liquid compile-check.

### Этап F: API cutover
- Переключить `chats.core.api.ts`, `chat-entries.api.ts`, `message-variants.core.api.ts` на `runChatGenerationV3`.
- Убрать дубли build/system prompt логики из роутов.

### Этап G: Cleanup
- Удалить legacy pathway из `prompt-draft-builder` и старого orchestrator runtime.

## 10) DoD

- D1: В прод-коде ровно один lifecycle orchestrator (`runChatGenerationV3`).
- D2: `prompt-draft-builder` не исполняет операции.
- D3: Любые operation effects проходят через commit слой.
- D4: Результат детерминирован в `executionMode="concurrent"`.
- D5: before artifacts доступны after в том же run.
- D6: save-time валидатор блокирует невалидные hook/output комбинации.
- D7: Для каждого run есть phase report + commit report.

## 11) Риски и mitigation

Риски:
- Регресс по текущему SSE-контракту и статусам генерации.
- Различия поведения legacy роутов (message-based vs entry-parts).
- Повышение сложности миграции из-за dual-path на переходе.

Mitigation:
- Контрактные интеграционные тесты до и после каждого этапа.
- Cutover по endpoint-ам постепенно, с rollback через git revert/patch rollback.
