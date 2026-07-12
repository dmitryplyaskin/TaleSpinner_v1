# Аудит backend и блока Operations TaleSpinner

Дата: 2026-07-10  
Область анализа: `server/src/**`, shared-контракты операций, документация Operations и связанные backend-тесты.  
Назначение: самостоятельный handoff-документ для следующей сессии, в которой будут исправляться найденные проблемы.

## Краткий вывод

В TaleSpinner уже заложено сильное ядро управляемой narrative generation:

- генерация разбита на явные фазы;
- профили операций собираются из переиспользуемых блоков;
- операции исполняются как детерминированный DAG;
- результаты операций представлены как effects;
- доступ к LLM изолирован через gateway;
- существуют typed events, cancellation, artifacts, runtime state и развитый набор тестов.

Главная проблема не в общей идее, а в несовпадении заявленной модели с фактическими runtime-гарантиями. Система выглядит как воспроизводимый workflow engine с транзакционными барьерами, но execution, effect staging, persistence и finalization разделены не полностью. Неуспешный или отменённый run может оставить persistent artifacts, изменённые activation counters, knowledge access state, переписанный user turn или UI parts.

Полная перепись backend не нужна. Следует сохранить текущий generation engine и последовательно обеспечить четыре гарантии:

1. Каждый начатый run доходит до наблюдаемого terminal state.
2. Operation execution не изменяет persistence, а только возвращает proposed effects.
3. Persistent effects применяются по явно выбранной политике атомарности.
4. После завершения можно восстановить точный compiled plan и результаты его операций.

## Исходное состояние проверок

Во время аудита успешно выполнены:

- `yarn typecheck:server`;
- `yarn lint:server`;
- `yarn --cwd server test`;
  - 100 test files passed;
  - 502 tests passed.

Следовательно, большинство находок ниже — это не обычные ошибки компиляции, а пробелы в сквозных гарантиях, failure semantics и соответствии runtime публичным контрактам.

## Прогресс исправлений

Обновлено: 2026-07-13.

| Задача | Статус | Коммит | Результат |
| --- | --- | --- | --- |
| OPS-001 | Выполнено | `baa690b` | Preparation failures наблюдаемы в SSE; созданная generation финализируется; пустой assistant scaffolding удаляется при ошибке до создания generation. |
| OPS-002 | Выполнено | `3dad07e` | Assistant rewrite сохраняется в main-part; required/optional persistence failures соблюдают policy; UI получает `turn.assistant.canonicalized`. |

Проверки после OPS-002:

- backend: 101 test files, 513 tests passed;
- frontend: 36 test files, 121 tests passed;
- `yarn verify:server` и `yarn verify:web` прошли;
- `yarn build:server` и `yarn build:web` прошли.

Phase A завершена частично: OPS-001 и OPS-002 закрыты, передача operation errors в SSE остаётся следующей задачей.

## Как Operations работают сейчас

Текущий runtime flow:

1. Разрешается LLM runtime и глобально активный operation profile.
2. Загружаются включённые operation blocks, на которые ссылается профиль.
3. Block-local `opId` namespace-ятся идентификатором блока.
4. Блоки превращаются в плоский массив операций и DAG.
5. Собирается base prompt.
6. Загружаются и заранее обновляются activation counters.
7. Исполняется DAG `before_main_llm`.
8. Созданные effects применяются к prompt, artifacts, turns и UI.
9. Required barrier решает, можно ли запускать основную LLM.
10. Main LLM стримит ответ с периодической записью assistant parts.
11. Исполняется DAG `after_main_llm`.
12. Применяются after-effects.
13. В generation сохраняются phase reports и commit reports.

Целевая модель:

1. Compile immutable executable plan.
2. Validate полный plan и все resource bindings.
3. Execute nodes на immutable input snapshots.
4. Получить typed results и proposed effects без persistent mutations.
5. Применить required/optional barrier policy.
6. Commit принятые effects по явной transaction policy.
7. Сохранить plan fingerprint, operation results и commit report.
8. Гарантированно завершить run и generation одним terminal status.

## Приоритеты

- **P0 — blocker:** потеря ошибок, невозможное runtime-состояние, нарушение security boundary или полностью неработающее заявленное поведение.
- **P1 — высокий риск:** partial state, неконтролируемая стоимость, потеря обновлений, невалидные workflow или нарушение воспроизводимости.
- **P2 — архитектурный долг:** неоднозначная семантика, плохая диагностика, высокая цена изменений или риск будущей миграции.
- **P3 — cleanup:** устаревшие документы, мёртвый код, naming и некритичная консистентность.

---

## P0 — блокирующие проблемы

### OPS-001. Ошибки до создания `RunState` могут полностью потеряться — выполнено

Статус: выполнено 2026-07-13, коммит `baa690b`.

Код:

- `server/src/services/chat-generation-v3/run-chat-generation-v3.ts:153-185`;
- `server/src/services/chat-generation-v3/run-chat-generation-v3.ts:496-525`.

Внешний `catch` финализирует generation и отправляет `run.finished` только при наличии одновременно `context` и `runState`. Если ошибка возникает во время provider resolution, compilation активного профиля, получения generation-control lease или загрузки persisted artifacts, async generator может просто закончиться без error event и без повторного throw.

Возможные последствия:

- SSE молча закрывается;
- пользователь не получает причину ошибки;
- пустой assistant placeholder остаётся в чате;
- уже созданная generation может навсегда остаться `streaming`;
- frontend cleanup получает `generationId = null`.

Решение:

- создать внешний lifecycle state до первого fallible шага;
- разделить `prepare.failed` и ошибку уже созданной generation;
- если generation ещё не существует, пробрасывать typed preparation error в transport;
- если generation существует, финализировать её даже без полноценного `RunState`;
- ввести terminal error envelope, не требующий полностью созданного run;
- очищать пустой assistant scaffolding после неуспешной подготовки.

Необходимые тесты:

- compilation активного профиля падает до создания `context`;
- acquisition control lease падает после создания generation, но до `RunState`;
- загрузка artifacts падает до `createInitialRunState`;
- SSE получает ошибку;
- generation не остаётся `streaming`;
- пустой assistant scaffolding удаляется или явно отмечается failed.

### OPS-002. `assistant_output_main` rewrite не сохраняется — выполнено

Статус: выполнено 2026-07-13, коммит `3dad07e`.

Код:

- `server/src/services/chat-generation-v3/operations/commit-effects-phase.ts:257-266`;
- `server/src/services/chat-generation-v3/main-llm/run-main-llm-phase.ts:22-57`.

Effect `turn.assistant.replace_text` меняет только `runState.assistantText`. Assistant part сохраняется во время main LLM streaming, то есть до запуска after-operations. Повторной записи после assistant rewrite нет.

Operation может закончиться как `done`, effect — как `applied`, а сохранённое сообщение и UI останутся с первоначальным текстом.

Решение:

- добавить `persistAssistantTurnText`, аналогичный user-turn handler;
- передавать в commit `assistantMainPartId`;
- менять `runState.assistantText` только после успешной persistence;
- отправлять отдельный assistant rewrite/canonicalization event для немедленного обновления UI;
- определять итог run через `required` при ошибке persistence.

Необходимые тесты:

- after-operation действительно меняет assistant main part;
- UI/SSE получает финальный переписанный текст;
- ошибка persistence порождает `commit.effect_error`;
- required rewrite failure завершает run ошибкой;
- optional failure сохраняет исходный assistant text.

### OPS-003. Local backend не имеет строгой сетевой границы

Код:

- `server/src/app.ts:33`;
- `server/src/app.ts:57-59`;
- `server/src/core/request-context/request-context.ts:62-72`.

Сервер слушает порт без явного loopback host и использует unrestricted CORS. При этом auth отсутствует, а caller может передать `ownerId`.

Решение:

- по умолчанию слушать только `127.0.0.1`;
- разрешать LAN exposure только явной env-настройкой;
- ограничить CORS origin desktop/web origin приложения;
- перестать принимать owner как доверенное правило из request body;
- документировать риски LAN mode;
- рассмотреть local session token для desktop-to-backend запросов.

Необходимые тесты:

- default host — loopback;
- LAN host работает только после явного opt-in;
- неподтверждённые origins отклоняются;
- body не может переопределить trusted owner scope.

### OPS-004. Operation repositories не соблюдают owner scope

Код:

- `server/src/services/operations/operation-profiles-repository.ts:61-70`;
- `server/src/services/operations/operation-profiles-repository.ts:125-186`;
- `server/src/services/operations/operation-blocks-repository.ts:73-82`;
- `server/src/services/operations/operation-blocks-repository.ts:125-168`.

`getOperationProfileById` и `getOperationBlockById` ищут только по ID. Update сначала загружает запись без owner scope, затем выполняет owner-scoped `UPDATE`, после чего снова делает unscoped read. При неверном owner API способен вернуть неизменённую чужую запись как успешный результат.

Profile creation и compilation также не требуют совпадения owner у профиля и блоков.

Решение:

- сделать owner обязательным во всех repository methods для owner-controlled сущностей;
- использовать форму `getById({ ownerId, id })`;
- проверять affected row count для update/delete;
- запрещать ссылку profile на block другого owner;
- scope-ить export, activation, bundle operations и runtime resolution;
- оставить unscoped lookup только как явно названный internal/admin method, если он действительно нужен.

Необходимые тесты:

- cross-owner read/update/delete/export не проходят;
- profile не может ссылаться на чужой block;
- update с неправильным owner возвращает not found;
- runtime не использует активный профиль другого owner.

---

## P1 — высокоприоритетные проблемы

### OPS-005. Operation execution не является side-effect-free

Код:

- `server/src/services/chat-generation-v3/operations/knowledge-operation-executor.ts:80-100`;
- `server/src/services/chat-knowledge/knowledge-reveal-service.ts:95-114`.

`knowledge_reveal` изменяет knowledge access state прямо во время execute. Это обходит execute/commit boundary, и mutation невозможно откатить, если позже упадёт required operation или commit.

Решение:

- разделить reveal на read-only planning и mutation handler;
- добавить typed effect `knowledge.reveal`;
- применять его только в commit phase;
- включить mutation в общую transaction policy;
- сделать повторное применение idempotent.

### OPS-006. Activation counters сохраняются до успешного выполнения run

Код:

- `server/src/services/chat-generation-v3/run-chat-generation-v3.ts:226-241`.

Counters увеличиваются или сбрасываются до выполнения операций и main LLM. Failed или aborted run всё равно потребляет activation interval.

Решение:

- вычислять decision в памяти;
- коммитить counters только при выбранном policy state;
- явно решить, когда interval считается использованным: `started`, `done` или successful effect commit;
- при необходимости хранить отдельно attempt и success state;
- обновлять counters атомарно с operation effects.

### OPS-007. Commit effects допускает частичное применение

Код:

- `server/src/services/chat-generation-v3/operations/commit-effects-phase.ts:123-289`.

Effects применяются по одному. При ошибке она записывается в report, но ранее применённые persistent effects остаются. Required failure блокирует дальнейшие фазы, но не откатывает artifact writes, turn rewrites и UI parts.

Решение:

- классифицировать effects как in-memory, local transactional и external/irreversible;
- валидировать и stage-ить все effects до начала применения;
- проводить local persistent effects через один unit of work;
- менять `RunState` после успешного DB commit;
- формализовать policy: `atomic_per_operation`, `atomic_per_hook` или `best_effort`;
- для required operations по умолчанию использовать atomic semantics.

### OPS-008. `concurrent` запускает неограниченное число операций

Код:

- `server/src/services/chat-generation-v3/operations/execute-operations-phase.ts:536-543`;
- `server/src/core/operation-orchestrator/types.ts:90`;
- `server/src/core/operation-orchestrator/executor.ts:60-70`.

Runtime не передаёт `concurrency`, поэтому orchestrator использует `Infinity`. Validator не ограничивает количество operations. Один profile способен одновременно запустить большое число LLM/guard requests с retries.

Риски:

- неконтролируемая стоимость;
- provider rate limits;
- нагрузка на SQLite и event loop;
- плохая отмена, если все tasks уже стартовали.

Решение:

- ввести безопасный global default;
- добавить bounded `profile.concurrency`, если настройка нужна пользователю;
- иметь отдельные лимиты для LLM, knowledge и local tasks;
- предупреждать или отклонять чрезмерно дорогие profiles;
- сохранять abort semantics для queued tasks.

### OPS-009. Нет resource limits для operation profile и artifacts

Код:

- `server/src/services/operations/operation-block-validator.ts:128-142`;
- `server/src/services/operations/operation-block-validator.ts:372-378`.

Практически не ограничены:

- число операций;
- число dependencies и run conditions;
- число exposures;
- длина templates/prompts;
- размер JSON schema;
- `history.maxItems`;
- размер artifact value.

Решение:

- добавить configurable caps;
- ограничить artifact history и размер одного value;
- ограничить auxiliary LLM output, timeout и retry budget;
- проверять cumulative profile cost при compilation;
- при реальной необходимости большой истории перейти от перезаписи JSON array к отдельным history rows.

### OPS-010. `writeMode: "append"` не влияет на запись

Код:

- `server/src/services/chat-generation-v3/artifacts/run-artifact-store.ts:33-61`;
- `server/src/services/chat-generation-v3/artifacts/profile-session-artifact-store.ts:135-181`.

Оба stores всегда заменяют `value`. `writeMode` сохраняется только как metadata, а history обновляется независимо.

Решение:

- определить append semantics по format;
- text/markdown: concat с явным separator policy;
- JSON array: append items;
- JSON object: запретить append либо определить merge policy;
- если имелся в виду только history append, переименовать поле;
- гарантировать одинаковое поведение run-only и persisted stores.

### OPS-011. `format: "json"` не гарантирует structured JSON value

Код:

- `server/src/services/chat-generation-v3/operations/llm-operation-executor.ts:149-220`;
- `server/src/services/chat-generation-v3/operations/execute-operations-phase.ts:580-630`.

LLM JSON output парсится, но затем снова сериализуется в string. Template operation может пометить любой текст как JSON. Guard и knowledge возвращают objects. Downstream operation получает разные типы value при одном `format`.

Решение:

- LLM executor должен возвращать structured value для JSON mode;
- template JSON необходимо parse/validate до создания effect;
- каждый artifact effect должен проверяться перед commit;
- serialization должна оставаться деталью persistence;
- ввести typed artifact value union.

### OPS-012. `samplerPresetId` принимается, но игнорируется

Код:

- `server/src/services/operations/llm-operation-params.ts:53-70`;
- `server/src/services/chat-generation-v3/operations/llm-operation-executor.ts:378-401`.

Поле хранится и валидируется как string, но executor использует только inline `samplers`.

Решение:

- разрешать preset во время compile/preflight или execution;
- определить precedence preset и inline overrides;
- проверять existence и ownership preset;
- snapshot-ить resolved sampler settings в run trace;
- запрещать activation profile с dangling preset.

### OPS-013. Sampler ranges валидируются недостаточно строго

Код:

- `server/src/services/operations/llm-operation-params.ts:21-43`;
- `server/src/services/operations/guard-operation-params.ts:46-68`.

Большинство sampler fields требуют только finite number. В gateway могут попасть negative max tokens, fractional seed или probability вне допустимого диапазона.

Решение:

- вынести sampler schemas в единый shared source;
- валидировать probabilities и penalties;
- требовать integer positive token limits и integer seed;
- provider-specific extensions держать в provider schemas;
- не нормализовать silently значения, если это меняет intent пользователя.

### OPS-014. Невалидная композиция profile сохраняется до generation time

Код:

- `server/src/services/operations/operation-profiles-repository.ts:73-105`;
- `server/src/services/operations/operation-profile-resolver.ts:98-140`.

При save проверяется существование blocks, но весь profile не компилируется. Cross-block artifact tag conflict и другие composition errors можно сохранить и активировать. Ошибка возникнет только при generation и может потеряться из-за OPS-001.

Решение:

- создать единый `compileAndValidateOperationProfile` application service;
- вызывать его на create, update, activation, import и dry-run;
- возвращать structured diagnostics с block/op IDs;
- запрещать activation unsupported required kinds;
- дать editor отдельный validation endpoint.

### OPS-015. Block ordering можно нарушить значением operation order

Код:

- `server/src/services/operations/operation-profile-resolver.ts:16`;
- `server/src/services/operations/operation-profile-resolver.ts:25-46`;
- `server/src/services/operations/operation-block-validator.ts:215-224`.

Runtime order вычисляется как `blockIndex * 1_000_000 + operation.order`, но operation order может быть любым finite number. Большие положительные или отрицательные значения interleave-ят разные blocks.

Решение:

- хранить structured tuple `(blockIndex, operationOrder, opId)`;
- сравнивать tuple напрямую;
- отказаться от numeric bucket encoding;
- ограничить editor order bounded integer, если это удобно UI.

### OPS-016. Hook/exposure validation разрешает противоречивые конфигурации

Код:

- `server/src/services/operations/operation-block-validator.ts:466-494`;
- `server/src/services/chat-generation-v3/operations/effect-policy.ts:7-36`.

Operation может содержать оба hooks и exposure, допустимый только в одном. Validator проверяет наличие требуемого hook, но не запрещает несовместимый дополнительный hook. Во второй фазе тот же effect падает policy error.

Кроме того, `turn.user.replace_text` разрешён после main LLM, то есть user input может измениться уже после того, как assistant ответил на прежний текст.

Решение:

- prompt effects и user rewrite разрешать только before;
- assistant rewrite — только after;
- artifact/UI effects — в обоих hooks;
- либо сделать exposure явно hook-scoped;
- отклонять противоречия во время compilation.

### OPS-017. Semantics dependency state неоднозначна и ограничена direct dependencies

Код:

- `server/src/services/chat-generation-v3/operations/execute-operations-phase.ts:117-130`;
- `server/src/services/chat-generation-v3/operations/execute-operations-phase.ts:550-566`.

Operation восстанавливает preview state только из прямых `dependsOn`. В цепочке `A -> B -> C` операция C не получает effects A автоматически, если A не указан у C напрямую. Sequential mode управляет scheduler, но не делает результаты предыдущих unrelated operations видимыми во время execution.

Решение:

- определить, являются dependencies scheduling edges, data edges или обоими;
- при inherited-state semantics replay-ить transitive ancestor closure;
- при direct-input semantics моделировать read sets/inputs явно;
- документировать, что sequential mode сам по себе не создаёт data flow;
- покрыть тестами chain, diamond и independent branches.

### OPS-018. Artifact identity разделена между `artifactId` и `tag`

Код:

- `shared/types/operation-profiles.ts:84-98`;
- `server/src/services/operations/operation-profile-resolver.ts:35-50`;
- `server/src/services/chat-generation-v3/operations/execute-operations-phase.ts:31-46`.

Compilation переписывает `artifactId`, но runtime stores, knowledge sources и template shorthand в основном используют `tag`. Неясно, какое поле является реальной identity и что стабильно между runs.

Решение:

- immutable artifact ID использовать как identity;
- tag считать human-readable alias;
- определить alias uniqueness в compiled profile;
- хранить оба поля явно;
- разрешать shorthand через compiled alias table, а не fallback lookups.

### OPS-019. Lifecycle artifacts и activation state не совпадает

Код:

- `server/src/services/chat-generation-v3/prepare/resolve-run-context.ts:16-34`;
- `server/src/services/chat-generation-v3/run-chat-generation-v3.ts:210-240`;
- `server/src/db/schema/chat-runtime-state.ts:24-31`.

Artifact session key включает profile version и block versions. Редактирование profile/block создаёт новую artifact session. Activation state при этом scoped по profile ID и `operationProfileSessionId`, без того же version fingerprint. После edit artifacts сбрасываются, а counters продолжаются.

Решение:

- определить единую operation session identity;
- явно решить, сохраняют ли config edits state;
- одинаково применять identity к artifacts и activation counters;
- сделать manual session reset предсказуемым;
- добавить retention/garbage collection старых unreachable sessions.

### OPS-020. Concurrent runs могут терять runtime-state и artifact updates

Код:

- `server/src/services/chat-generation-v3/artifacts/profile-session-artifact-store.ts:123-173`;
- `server/src/services/chat-generation-v3/runtime/chat-runtime-state-repository.ts:137-170`.

Persisted artifact update — read-then-write. Activation runtime state заменяет весь JSON payload. Две generation одного chat/branch/profile могут потерять history/counters или столкнуться при insert.

Решение:

- либо разрешать только одну active generation на chat branch;
- либо явно поддержать concurrent runs с conflict policy;
- использовать transactional UPSERT для artifact value/history;
- ввести optimistic versioning runtime state;
- не заменять unrelated counters из stale full-payload snapshot.

### OPS-021. Import operation profiles неатомарен

Код:

- `server/src/application/operations/use-cases/import-operation-profiles.ts:22-122`;
- `server/src/db/ensure-operation-blocks-cutover.ts:42-104`.

Import и startup cutover выполняют несколько writes без общей transaction. Ошибка оставляет orphan blocks или partial profiles. Прерванный cutover между insert block и update profile способен создать duplicate orphan при следующем запуске.

Решение:

- валидировать bundle полностью до write;
- импортировать каждый bundle одной DB transaction;
- передавать transaction в block/profile repositories;
- сделать cutover idempotent через marker или deterministic block ID;
- добавить failure-injection integration tests.

### OPS-022. Profile/block updates не имеют optimistic concurrency

Код:

- `server/src/services/operations/operation-profiles-repository.ts:125-186`;
- `server/src/services/operations/operation-blocks-repository.ts:125-168`.

Update использует read-modify-write и считает `version + 1` вне compare-and-set. Concurrent editors могут потерять изменения и получить одинаковый next version.

Решение:

- требовать `expectedVersion`;
- выполнять update через `WHERE id AND owner_id AND version`;
- возвращать typed version conflict;
- frontend должен явно reload/merge;
- ту же механику применять к import/update tools.

### OPS-023. Generation creation не имеет полноценной idempotency semantics

Начальные user/assistant записи создаются транзакционно, но HTTP retry после network interruption может создать второй turn и повторно выполнить persisted operations.

Решение:

- использовать стабильный client request/idempotency key;
- обеспечить uniqueness в owner/chat/branch scope;
- повторный принятый request должен возвращать существующий session/run;
- отличать retry от намеренного regenerate/continue;
- сохранять idempotency correlation в operation run trace.

---

## P2 — архитектурные и диагностические проблемы

### OPS-024. Operation execution results не сохраняются долговременно

Код:

- `server/src/services/chat-generation-v3/contracts.ts:279-309`;
- `server/src/services/chat-generation-v3/persist/finalize-run.ts:9-32`.

`RunState` содержит `operationResultsByHook`, но `RunResult` их исключает. Finalization сохраняет только phase и commit reports. После reload нельзя определить, какие operations запускались, были skipped, failed или вернули конкретный output.

Решение:

- добавить durable run trace или operation-run tables;
- хранить plan fingerprint, profile/block versions, statuses, timings, skip details и safe errors;
- определить retention/redaction operation outputs;
- добавить owner-scoped historical trace API;
- использовать один контракт для live и historical frontend trace.

### OPS-025. Точный compiled plan невозможно восстановить

`ProfileSnapshot` содержит compiled operations только в памяти. Generation persistence не хранит full snapshot или разрешимый immutable plan version. Profile version недостаточно, потому что blocks меняются независимо.

Решение:

- считать canonical compiled-plan hash;
- сохранять profile ID/version, ordered block IDs/versions, session identity и plan hash;
- при необходимости replay сохранять canonical compiled spec;
- либо ввести immutable revisions/audit log profile и blocks.

### OPS-026. Operation errors не попадают в SSE completion events

Код:

- `server/src/services/chat-generation-v3/operations/execute-operations-phase.ts:712-741`.

Для `error` и `aborted` event содержит status, но не `task.error` или abort reason, хотя контракт поддерживает поле `error`.

Решение:

- сначала строить terminal result, затем emit event;
- включать stable error code, safe message и abort reason;
- перечислять failing operation IDs в required barrier message;
- редактировать provider errors и секретные данные.

### OPS-027. Phase status не отражает реальные operation errors

Код:

- `server/src/services/chat-generation-v3/orchestration/run-operation-hook-phase.ts:68-128`.

Execute phase отмечается `done`, если orchestrator вернул результат, даже при failed operations. Commit phase считается failed только для required errors; optional effect errors дают phase `done`.

Решение:

- различать `completed`, `completed_with_errors`, `failed`, `aborted` либо хранить summary counts;
- отделить barrier policy от health фазы;
- сохранять done/skipped/error/aborted totals.

### OPS-028. `commit.effect_skipped` объявлен, но не используется

Код:

- `server/src/services/chat-generation-v3/contracts.ts:343-351`;
- `server/src/services/chat-generation-v3/operations/commit-effects-phase.ts:112-115`.

Контракт допускает skipped effect, но commit фактически только применяет effect или фиксирует error.

Решение:

- удалить unused state;
- либо определить реальные skip cases: deduplication, superseded write, optional missing target, explicit policy;
- покрыть все states contract tests.

### OPS-029. Required operations не fail-fast

Required проверяется только на barrier после завершения всех runnable tasks. В concurrent mode дорогие sibling LLM operations продолжаются после failure required node.

Решение:

- формально выбрать `barrier_only` или `fail_fast` semantics;
- при fail-fast отменять queued и при необходимости running siblings;
- сделать policy profile-level настройкой, если нужны оба поведения;
- сохранить best-effort optional branches только как осознанный режим.

### OPS-030. Credentials и presets late-bound без preflight

Profiles можно сохранить и экспортировать с dangling `credentialRef`, provider, model или sampler preset. Dedicated operation bundle не может безопасно перенести local credential ID на другую установку.

Решение:

- проверять resource existence в profile preflight;
- никогда не экспортировать token values;
- экспортировать logical credential slots вместо local IDs;
- importer должен привязать slots к local credentials;
- unresolved bindings должны быть видны до activation.

### OPS-031. Custom regex способен блокировать event loop

LLM JSON extraction выполняет произвольный JavaScript regex на provider output. Проверяется syntax, но не complexity и input size.

Решение:

- ограничить pattern и output size;
- запретить ненужные risky flags;
- предпочесть safe extraction без backtracking;
- при сохранении power-user regex выполнять его в worker/timebox.

### OPS-032. Prompt diagnostics всегда сохраняют много пользовательского контента

Код:

- `server/src/services/chat-generation-v3/run-chat-generation-v3.ts:326-341`;
- `server/src/services/chat-generation-v3/prompt/generation-debug-payload.ts:229-287`;
- `server/src/services/chat-core/generations-repository.ts:240-257`.

Full LLM messages сохраняются в debug JSON независимо от SSE debug flag. Limit сериализации — 450 KB на generation. Дополнительно хранится truncated prompt snapshot.

Риски:

- рост SQLite;
- длительное хранение чувствительного narrative content;
- дублирование prompt data;
- неочевидная пользователю retention policy.

Решение:

- отделить обязательные reproduction data от optional debug data;
- добавить retention setting и cleanup;
- по умолчанию хранить hashes и structural metadata;
- full prompt retention сделать явным opt-in;
- не дублировать content в snapshot/debug;
- добавить configurable redaction.

### OPS-033. Ключевые operation files чрезмерно велики

На момент аудита:

- `operation-block-validator.ts` — 867 lines;
- `execute-operations-phase.ts` — 794 lines;
- `contracts.ts` — 569 lines;
- `run-chat-generation-v3.ts` — 529 lines.

Это превышает repository contract и концентрирует риски в самых изменяемых участках.

Решение:

- создать operation-kind registry: schema, compiler, executor, capabilities;
- вынести graph validation, artifact validation, hook policy и import migration;
- разделить context construction, task construction, event mapping и result mapping;
- оставить top-level generation engine небольшим phase coordinator.

### OPS-034. Application-layer boundary остаётся непоследовательной

Новые chat generation flows используют application use cases, но многие API routes напрямую вызывают repositories. Repositories одновременно выполняют validation, owner defaults, JSON normalization и business decisions.

Решение:

- создать application services для operation CRUD, compile/validate, activation, import/export и runtime-state reads;
- routes оставить validation/transport слоем;
- repositories оставить persistence/DTO mapping слоем;
- owner/request context и transaction передавать явно.

### OPS-035. Доступность API связана с optional bootstrap systems

Код:

- `server/src/core/bootstrap/bootstrap-coordinator.ts:24-67`.

До старта API выполняются migrations, schema cutovers, LLM, RAG и Chroma bootstrap. Отказ optional subsystem способен заблокировать весь backend.

Решение:

- классифицировать steps как required/optional;
- показывать readiness каждого subsystem;
- optional integrations инициализировать lazy или поддерживать degraded mode;
- migration failure оставить fatal;
- отсутствие Chroma не должно обязательно блокировать non-RAG chat.

### OPS-036. Runtime рассчитан на один Node process

Durable generation-control lease уже появился, но execution и AbortController остаются process-local. Для текущего local application это допустимо, но ограничивает workers, scale и restart recovery.

Решение:

- явно зафиксировать single-process support текущей версии;
- durable run state считать authoritative, in-memory controllers — optimization;
- будущих workers строить на lease ownership/heartbeat;
- не вводить multi-process deployment до решения artifact/activation concurrency.

---

## P3 — cleanup и документация

### OPS-037. Документация Operations устарела

Код:

- `docs/docs/user/operations.md:47-54`;
- `docs/i18n/en/docusaurus-plugin-content-docs/current/user/operations.md:47-54`.

Документация утверждает, что runtime поддерживает только `template` и `llm`, хотя исполняются также `guard`, `knowledge_search` и `knowledge_reveal`.

Решение:

- обновить RU и EN одновременно;
- описать hooks, activation, guard conditions и artifact lifecycle;
- перечислить реально unsupported kinds;
- после фикса OPS-017 документировать data-visibility semantics.

### OPS-038. В repository остались старые pipeline/template runtime concepts

Код:

- `server/src/services/operations/template-operations-runtime.ts`;
- `shared/types/pipelines.ts`;
- `shared/types/pipeline-profile-spec.ts`;
- `shared/types/pipeline-execution.ts`.

Old template runtime используется только собственными тестами, а pipeline contracts отключены от актуального Operations engine. Они создают две конкурирующие архитектурные модели.

Решение:

- проверить отсутствие внешних consumers;
- перенести полезные контракты в текущую модель;
- удалить dead runtime и obsolete tests;
- использовать один термин для актуального compiled operation workflow.

### OPS-039. Error messages смешивают языки и abstraction levels

Validation/API errors используют одновременно English и Russian strings. Frontend вынужден зависеть от free-form messages.

Решение:

- использовать stable English error codes и structured details;
- локализовать сообщения во frontend;
- передавать `blockId`, `opId`, field path и conflict IDs;
- не заставлять UI парсить strings.

### OPS-040. Колонка `usage` хранит artifact format

Код:

- `server/src/db/schema/operation-profiles.ts:83-87`;
- `server/src/services/chat-generation-v3/artifacts/profile-session-artifact-store.ts:61-70`.

Legacy column `usage` сейчас интерпретируется как `ArtifactFormat`, хотя старый контракт usage использовал значения `prompt_only`, `ui_only` и другие.

Решение:

- добавить explicit `format` и `semantics` либо versioned artifact envelope;
- мигрировать existing rows;
- перестать переиспользовать legacy column name с другой семантикой.

---

## Предлагаемая целевая архитектура

### 1. `CompiledOperationPlan`

Canonical plan должен содержать:

- plan version;
- profile ID/version;
- ordered block IDs/versions;
- canonical plan hash;
- normalized operations;
- validated dependency graph;
- resolved capabilities и resource bindings;
- concurrency/failure policies;
- artifact ID/tag symbol table.

Compilation должна быть pure, кроме resource lookups, и возвращать structured diagnostics.

### 2. Operation-kind registry

Каждый operation kind предоставляет:

- input schema;
- compile/preflight validation;
- capabilities;
- executor;
- output validator;
- allowed hooks;
- allowed effects;
- cost/resource class.

Это заменит растущие `if (op.kind === ...)` в validator и executor.

### 3. Side-effect-free operation execution

Пример результата executor:

```ts
type OperationNodeResult = {
  output: unknown;
  effects: RuntimeEffect[];
  diagnostics: OperationDiagnostics;
};
```

Executor может вызывать external read/generation services, но не должен изменять TaleSpinner persistence. Knowledge reveal должен стать effect.

### 4. Explicit commit policy

Нужно выбрать поддерживаемые policies:

- `atomic_per_hook` — local effects одного hook коммитятся вместе;
- `atomic_per_operation` — effects каждой operation атомарны отдельно;
- `best_effort` — partial state разрешён и явно отражён;
- `fail_fast` или `barrier_only` для required failure.

Рекомендуемый default: `atomic_per_hook` для local DB mutations. External LLM calls происходят во время execute, но в persistence попадают только принятые результаты.

### 5. Durable run trace

Минимально сохранять:

- run/generation ID;
- plan hash и source versions;
- hook/op IDs;
- timestamps и duration;
- status и skip details;
- safe error code/message;
- effect type и commit status;
- provider/model/resolved samplers для LLM operations;
- output metadata или redacted output по retention policy.

### 6. Unified operation session lifecycle

Единая session identity должна включать только поля, которые намеренно сбрасывают state, и одинаково применяться к:

- persisted artifacts;
- activation counters;
- guard/runtime state;
- historical trace correlation.

Config revision и manual reset должны иметь раздельно описанное поведение.

---

## Рекомендуемая последовательность исправлений

### Phase A. Terminal-state correctness

1. [x] Исправить OPS-001.
2. [x] Добавить preparation failure events и cleanup.
3. [x] Исправить assistant rewrite persistence из OPS-002.
4. [ ] Добавить operation errors в SSE.
5. [x] Сначала написать regression tests для выполненных задач.

Критерии завершения:

- каждый request имеет понятный terminal result;
- generation не остаётся `streaming` после обработанной ошибки;
- assistant rewrite меняет persisted content;
- frontend получает actionable operation error.

### Phase B. Security и bounded execution

1. Исправить owner scope.
2. Bind на loopback и ограничить CORS.
3. Ввести concurrency cap.
4. Добавить profile/artifact resource limits.
5. Усилить sampler validation.

Критерии завершения:

- cross-owner доступ невозможен;
- backend не доступен в LAN по умолчанию;
- profile не запускает unbounded provider calls;
- чрезмерные configs отклоняются на edge.

### Phase C. Contract correctness

1. Реализовать или переопределить artifact append.
2. Сделать JSON artifacts structured.
3. Разрешать sampler presets.
4. Заменить numeric order buckets.
5. Enforce hook/exposure compatibility.
6. Определить dependency data visibility.

Критерии завершения:

- каждое публичное operation field имеет tested runtime behavior;
- artifact shape соответствует format;
- editor-valid profile не падает из-за известных composition contradictions.

### Phase D. Transaction и state model

1. Перенести knowledge mutations в effects.
2. Stage-ить effects до commit.
3. Реализовать выбранную atomic commit policy.
4. Commit activation counters по документированной success semantics.
5. Решить concurrent run/lost update behavior.
6. Сделать imports и cutover transactional.

Критерии завершения:

- required failure не оставляет unintended persistent mutations;
- concurrent runs не теряют artifact history/counters;
- import — all-or-nothing.

### Phase E. Reproducibility и maintainability

1. Сохранять compiled-plan fingerprint и operation trace.
2. Добавить optimistic versioning profile/block.
3. Разделить oversized modules через registry.
4. Удалить obsolete pipeline/template runtime.
5. Добавить debug retention/redaction policy.
6. Обновить RU/EN documentation.

Критерии завершения:

- historical generation указывает точный operation plan;
- run trace переживает reload;
- concurrent edit не перетирает changes silently;
- в repository остаётся одна canonical Operations implementation.

## Рекомендуемый первый fix batch

Безопасный первый batch должен быть узким:

1. [x] Добавить failing tests на preparation errors и assistant rewrite persistence.
2. [x] Изменить `runChatGenerationV3`, чтобы все failure paths завершались наблюдаемо.
3. [x] Persist-ить `turn.assistant.replace_text` через отдельный handler.
4. [ ] Передавать error information в `operation.finished`.
5. [ ] Compile/validate profile до activation.
6. [ ] Добавить conservative concurrency cap.

Этот batch исправит пользовательскую correctness, не требуя одновременно завершать полную transaction redesign.

## Definition of Done для Operations subsystem

- Сохранённый и активированный profile гарантированно компилируется.
- Каждое поддерживаемое поле имеет определённую и протестированную semantics.
- Unsupported required kinds нельзя активировать silently.
- Каждый run доходит до одного terminal status и отдаёт usable error.
- Operation execution не изменяет TaleSpinner persistence напрямую.
- Local effects применяются по explicit transaction policy.
- Required failure не оставляет unintended partial persistent state.
- Concurrent execution ограничен.
- Owner scope соблюдается в CRUD, export, activation и runtime.
- Artifact value shape соответствует declared format.
- Artifacts и activation state используют один documented session lifecycle.
- Точный compiled plan и operation results доступны после run.
- RU и EN documentation описывает фактическое поведение.
