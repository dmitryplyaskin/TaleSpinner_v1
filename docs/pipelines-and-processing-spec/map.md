# Карта спеки: Pipelines + Pre/Post Processing

Эта папка — каноническое место для спеки по пайплайнам и пре/постпроцессингу.

## Файлы

- `map.md` — этот файл (оглавление/индекс).
- `pipelines-and-processing-spec-v0.1.md` — монолитная версия (legacy snapshot; удобна для поиска/сравнения, но дальше стремимся править части). 
UPD: Текуща версия спецификации была во многом улучшена и доработана и может иметь большое расхождение с legacy версией.

## Оглавление (v0.1)

- [00 — Overview](./00-overview.md)
- [10 — Execution model](./10-execution-model.md)
- [20 — Mutation policy](./20-mutation-policy.md)
- [30 — Step types](./30-step-types.md)
- [40 — Artifacts](./40-artifacts.md)
- [50 — Observability](./50-observability.md)
- [55 — Logging & reproducibility](./55-logging-and-reproducibility.md)
- [60 — SSE events](./60-sse-events.md)
- [90 — Future & open questions](./90-open-questions.md)

## Недавние договорённости (v0.1+)

- Введены термины **`PipelineProfile`** (набор активных пайплайнов) и **`Session`** (chat-scoped состояние артефактов).
- Для `art.<tag>` зафиксированы: уникальность в пределах `chat`, **single-writer**, модель хранения **Latest + History**.
- **`main llm`** в v1 — **строго один** “канонический” процесс стрима/сохранения на момент времени (в рамках ветки/чата).
- Порядок запуска пайплайнов в v1 определяется **позицией в `PipelineProfile`**: “выше” → выполняется раньше.
- Композиция, когда **несколько пайплайнов одновременно пишут в один `PromptDraft`**, в v1 сознательно **не формализуем** (тема v2+/итерации на момент реализации).

## Как редактируем дальше (цель разбиения)

Идея: постепенно вынести самодостаточные куски в отдельные файлы и из этого файла сделать “оглавление/индекс”.

Рекомендуемая стратегия разбиения (без смены смысла):

- **00-overview.md**: цели, non-goals, термины, инварианты
- **10-execution-model.md**: триггеры, flow хода, параллельность и очередь коммитов
- **20-mutation-policy.md**: mutation policy, write targets, ограничения
- **30-step-types.md**: `pre|rag|llm|post|tool` (семантика, вход/выход, примеры)
- **40-artifacts.md**: `PipelineArtifact`, visibility/uiSurface, prompt inclusion, ordering
- **50-observability.md**: логирование, воспроизводимость, redaction
- **60-sse-events.md**: SSE контракты событий
- **90-open-questions.md**: открытые вопросы / решения

## Правила ссылок

- Внутри `docs/` используем относительные ссылки.
- Старый путь `docs/pipelines-and-processing-spec-v0.1.md` сохранён как редирект на `docs/pipelines-and-processing-spec/pipelines-and-processing-spec-v0.1.md` (чтобы не ломать существующие ссылки).

