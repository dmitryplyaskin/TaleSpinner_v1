# v2 — Effects (контракт и commit)

Этот документ фиксирует **строгий контракт `Effect`** (что именно Operation возвращает наружу). Отдельный слой применения описан в документе **Effect Commit**: [`16-effect-commit.md`](./16-effect-commit.md).

Связанные документы:

- Термины: [`00-terminology.md`](./00-terminology.md)
- Operation (контракт и модель исполнения): [`10-operation.md`](./10-operation.md)
- Run (фазы и барьер): [`30-run.md`](./30-run.md)
- Artifacts (инварианты): [`40-artifacts.md`](./40-artifacts.md)

---

## 1) Главная идея

**Effect** — это **декларативное описание изменения** (“что должно быть применено”), которое операция просит применить при успешном завершении.

Ключевые инварианты v2:

- эффекты **коммитятся только если** `OperationResult.status="done"`;
- `skipped | error | aborted` считаются **“без эффекта”** (даже если операция внутри что-то “успела сделать”);
- операции могут исполняться конкурентно (**execute**), но эффекты применяются детерминированно (**commit**);
- структура `Effect` **не зависит от** `OperationDefinition.kind`: kind описывает внутреннюю работу операции, а effect описывает внешний результат.

> Мотивация: отделить “blackbox-исполнение” операций от контролируемого применения изменений в prompt/turn/artifacts, чтобы избежать магии и обеспечить воспроизводимость.

---

## 2) Разделение ответственности: Run vs Effect Commit

### 2.1 `Run` отвечает за

- планирование и запуск операций (включая `dependsOn`, `required`, `enabled`, `triggers`, `hooks`);
- управление фазами и барьером `before_main_llm`;
- вызов ровно одного `main LLM` (или ни одного, если барьер не пройден/abort);
- сбор `OperationResult` и `OperationRun`;
- определение **commit-очереди** (детерминированный порядок применения эффектов) и передачу эффектов в слой коммита;
- формирование финального результата `Run` и событий прогресса.

### 2.2 Слой **Effect Commit** отвечает за

- валидацию эффектов по схеме и политике (hook/phase constraints, размеры, безопасность);
- применение эффектов к конкретным таргетам:
  - prompt building (вставки/позиционирование/trim-policy),
  - turn canonicalization (variants/selected/blocks/meta),
  - artifact store (persisted/run_only, history/retention policies);
- разрешение конфликтов (если продукт вводит такие правила) или их явное обнаружение как ошибки коммита;
- формирование отчёта о применении (см. раздел 6) для наблюдаемости/UI.

> Важно: Operation может выполнять внешние интеграции внутри себя, но любые изменения “канонических” слоёв v2 (prompt/turn/artifacts) должны проходить через контролируемый commit.

---

## 3) Инварианты и политика commit

### 3.1 Commit-очередь (deterministic ordering)

Commit-порядок эффектов определяется **не** сетевым порядком завершения операций, а стабильно:

1) зависимости: если `B dependsOn A`, то эффекты `A` коммитятся раньше эффектов `B`;
2) среди готовых к коммиту: сортировка по `OperationConfig.order` (меньше — раньше);
3) tie-break: `operationId` (лексикографически), чтобы порядок всегда был стабильным.

### 3.2 Политика “done-only”

- `status="done"` → эффекты операции становятся кандидатами на commit
- `status="skipped|error|aborted"` → эффекты операции **не применяются**

### 3.3 Ограничения по хукам (policy constraints)

Минимальные ограничения v2:

- **Prompt effects** допустимы **только** в `before_main_llm` (после старта main LLM prompt менять нельзя).
- **Turn canonicalization effects**:
  - в `before_main_llm` можно менять только user-часть текущего turn,
  - в `after_main_llm` можно менять user и assistant-часть текущего turn.
- **Artifact effects** допустимы в обоих хуках, но запись применяется по commit-правилу и инвариантам артефактов.

---

## 4) Структура `Effect` (нормативно)

### 4.1 Принцип: эффекты — по “таргету/слою”, а не по `kind`

В v2 эффекты группируются по внешним таргетам:

- `prompt.*` — влияет на effective prompt (одноразово, только для текущего main LLM)
- `turn.*` — меняет канон текущего хода (variants/selected/blocks/meta)
- `artifact.*` — читает/пишет `art.<tag>` (persisted/run_only)

### 4.2 Минимальная типизация (рекомендуемая форма)

Ниже — рекомендуемая схема (как ориентир для TS-контракта). Конкретные поля/названия можно адаптировать, но **смысл** должен сохраниться.

```ts
// Base для стабильной валидации и логов.
type EffectBase = {
  // Дискриминатор: определяет форму payload.
  // Примеры: "prompt.insert_after_last_user", "artifact.upsert"
  type: string;

  // Необязательная человекочитаемая заметка (bounded).
  note?: string;
};

// ---- PROMPT ----

type PromptMessage = {
  role: "system" | "developer" | "user" | "assistant";
  content: string;
  source?: string; // например "art.world_state" или operationId
};

type PromptEffect =
  | (EffectBase & {
      type: "prompt.insert_after_last_user";
      message: PromptMessage;
    })
  | (EffectBase & {
      type: "prompt.system_update";
      mode: "prepend" | "append" | "replace";
      payload: string; // новый system (или вставка), в зависимости от mode
    })
  | (EffectBase & {
      type: "prompt.insert_at_depth";
      depthFromEnd: number; // 0 = tail, -N = "на глубину"
      message: PromptMessage;
    });

// ---- TURN ----

type TurnEffect =
  | (EffectBase & {
      type: "turn.user_variant.upsert_and_select";
      text: string;
    })
  | (EffectBase & {
      type: "turn.assistant_variant.patch";
      // patch-формат — продуктовый выбор (TBD): json-patch, merge-patch, custom blocks patch.
      patch: unknown;
    })
  | (EffectBase & {
      type: "turn.assistant_blocks.update";
      blocks: unknown; // bounded by policy
    });

// ---- ARTIFACT ----

type ArtifactEffect = EffectBase & {
  type: "artifact.upsert";

  tag: string; // адресуется как art.<tag>
  persistence: "persisted" | "run_only";

  usage: "prompt_only" | "ui_only" | "prompt+ui" | "internal";
  semantics: "state" | "log/feed" | "lore/memory" | "intermediate" | string;

  value: unknown;
  retention?: unknown; // только для persisted (политика/форма TBD)
};

type Effect = PromptEffect | TurnEffect | ArtifactEffect;
```

### 4.3 Про `value`

Поле `value` **нормативно** для `artifact.*` эффектов (это именно “новое значение артефакта”).

Для других effect-типов “value” не обязательно и не рекомендуется как универсальное поле:

- у prompt-эффектов payload — это `message`/`payload`;
- у turn-эффектов payload — это `text`/`patch`/`blocks`;
- “пустой value” как концепт допустим, но лучше выражать это отсутствием поля в типе, а не `value: null` везде.

---

## 5) Валидация эффектов (policy)

Слой commit обязан валидировать эффекты перед применением. Минимальные проверки:

- **hook constraints**:
  - любые `prompt.*` эффекты — только `before_main_llm`;
  - `turn.assistant_*` эффекты — только `after_main_llm`.
- **boundedness**: ограничения на размер `content`, `payload`, `blocks`, `value`/сериализацию (чтобы не взрывать логирование/БД/контекст).
- **artifact invariants**:
  - `tag` не пустой, допустимый формат;
  - соблюдается “one writer per tag” на уровне профиля (save-time), но commit может дополнительно проверять “операция пишет только в один tag” для раннего выявления нарушений.

> Рекомендуется: при провале валидации коммит возвращает машинный код ошибки (`validation_error | policy_error | artifact_conflict | ...`) и bounded сообщение.

---

## 6) Отчёт о применении (commit report) (рекомендуется)

Чтобы Run и UI могли объяснить “что реально применилось”, commit слой должен возвращать отчёт:

```ts
type AppliedEffect = {
  effectIndex: number; // индекс эффекта в OperationResult.effects (или нормализованный индекс)
  status: "applied" | "skipped" | "error";
  error?: { code: string; message: string };
};

type CommitReport = {
  applied: AppliedEffect[];
};
```

Политика влияния ошибок коммита на статус `Run` — продуктовая (TBD), но минимальная идея:

- если required операция `done`, но commit её эффекта не применился из-за `policy_error` → это должно быть видимо как failure в `Run` (чаще всего `failedType="after_main_llm"`), потому что итоговый канон/артефакты не соответствуют модели.

---

## 7) Примеры (схематично)

### 7.1 Guard → ветвление через `run_only` artifact

Операция-guard (`before_main_llm`) возвращает:

- `artifact.upsert` (`tag="is_combat"`, `persistence="run_only"`, `usage="internal"`, `semantics="intermediate"`, `value=true/false`)

Дальше зависимая операция читает `art.is_combat.value` (через `dependsOn` на guard) и либо:

- возвращает prompt/artefact эффекты и `done`,
- либо возвращает `skipped` (и commit ничего не применяет).

### 7.2 Augmentation notes в prompt (одноразово)

Операция (`before_main_llm`) возвращает:

- `artifact.upsert` (`tag="augmentation_notes"`, `run_only`, `usage="prompt_only"`, `value="<text>"`)
- `prompt.insert_after_last_user` (`message.role="developer"`, `message.content="<text>"`, `source="art.augmentation_notes"`)

---

Конкретные расширения схемы (якоря, сложное позиционирование в prompt, форматы patch для blocks/meta, конфликты/слияния артефактов) допускаются как v2+,
но базовый контракт “effects как декларативный changeset + отдельный commit слой” является фундаментальным для v2.

