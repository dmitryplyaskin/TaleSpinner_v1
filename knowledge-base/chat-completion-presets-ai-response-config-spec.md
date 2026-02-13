# Спека совместимости Chat Completion Presets + AI Response Configuration (SillyTavern parity, текущая ветка)

## 1. Цель, границы, терминология

**Цель**: зафиксировать публичный контракт импорта/экспорта и runtime-применения Chat Completion Preset так, чтобы внешний импортёр мог воспроизвести поведение SillyTavern идентично на текущей ветке.

**Границы**:
- Включено: OpenAI/Chat Completion preset lifecycle (UI -> storage -> apply -> generate payload), runtime-зависимости parity, legacy миграции, hooks/events.
- Не включено: полные контракты Kobold/Novel/TextGen пресетов как самостоятельные спецификации.
- Базовая совместимость: только текущий код этой ветки.

**Термины**:
- `preset file` — JSON файл в `OpenAI Settings/<name>.json`.
- `oai_settings` — runtime-настройки в `settings.json` (`oai_settings` раздел).
- `settingsToUpdate` — нормативная таблица соответствий `preset_key -> runtime key/UI selector/connection flag`.
- `connection data` — поля с `is_connection=true` в `settingsToUpdate`.
- `sensitive fields` — список из `public/scripts/openai.js`: `reverse_proxy`, `proxy_password`, `custom_url`, `custom_include_body`, `custom_exclude_body`, `custom_include_headers`, `vertexai_region`, `vertexai_express_project_id`, `azure_base_url`, `azure_deployment_name`.

## 2. Источники истины (нормативные файлы)

- `public/scripts/openai.js`: `settingsToUpdate`, `default_settings`, import/export/apply preset, миграции, `createGenerationParameters`, вызов `/generate`.
- `public/index.html`: UI блока `Chat Completion Presets` (select/save/update/rename/delete/import/export/bind).
- `public/scripts/preset-manager.js`: rename flow, extension field read/write, generic preset operations.
- `public/scripts/PromptManager.js`: миграция legacy prompt-ключей и реакция на `OAI_PRESET_CHANGED_*`.
- `public/scripts/events.js`: перечень событий/hook-имен.
- `public/script.js`: загрузка/сохранение `settings.json`; wiring `loadOpenAISettings(data, settings.oai_settings ?? settings)`.
- `src/endpoints/presets.js`: `/api/presets/save|delete|restore`, `sanitize-filename`, запись `<name>.json`.
- `src/endpoints/settings.js`: `/api/settings/get` с `openai_settings` и `openai_setting_names`.
- `src/endpoints/backends/chat-completions.js`: `/status`, `/generate`, `/bias`; provider-specific request shaping.
- `default/content/presets/openai/Default.json`: канонический shipped preset.

## 3. UI-спецификация панели Chat Completion Presets

### 3.1 Контролы

- Select пресета: `#settings_preset_openai`.
- Save as: `#new_oai_preset`.
- Update current: `#update_oai_preset`.
- Rename: `[data-preset-manager-rename="openai"]`.
- Delete: `#delete_oai_preset`.
- Import: `#import_oai_preset` + hidden `#openai_preset_import_file`.
- Export: `#export_oai_preset`.
- Bind toggle: `#bind_preset_to_connection`.

### 3.2 Поведение действий

1. Select preset:
- Читает preset из `openai_settings[openai_setting_names[name]]`.
- Выполняет `migrateChatCompletionSettings(preset)`.
- Эмитит `OAI_PRESET_CHANGED_BEFORE`.
- Применяет только ключи из `settingsToUpdate`.
- Если `bind_preset_to_connection=false`, все `is_connection=true` ключи пропускаются.
- Для `extensions` нет UI fallback: `oai_settings.extensions = preset.extensions || {}`.
- При `bind=true` дополнительно триггерит `#chat_completion_source change` + provider/quantizations refresh.
- После применения: `saveSettingsDebounced()`, `OAI_PRESET_CHANGED_AFTER`, `PRESET_CHANGED`.

2. Save as (`new`):
- Запрос имени через popup.
- Сериализация через `getChatCompletionPreset()` (только ключи `settingsToUpdate`).
- POST `/api/presets/save` (`apiId=openai`).

3. Update:
- Аналогично save, в текущее имя пресета.

4. Rename:
- Выполняется через `PresetManager.renamePreset(newName)`.
- Для `openai` используется workaround: после rename триггерится `#update_oai_preset` (перезапись корректным openai preset body).
- Переносит `extensions` поле старого имени в новое.

5. Delete:
- UI удаляет option локально, переключает на первый доступный preset.
- POST `/api/presets/delete`.

6. Import:
- Имя пресета берётся из **имени файла** (basename), а не из JSON `name`.
- Парсинг JSON; при sensitive полях popup с тремя исходами:
  - `Remove them` -> удалить `sensitiveFields`.
  - `Import as-is` -> оставить.
  - `Cancel import` -> abort.
- POST `/api/presets/save`.
- Если имя уже существует -> overwrite confirm.
- Эмитит `OAI_PRESET_IMPORT_READY` до сохранения.

7. Export:
- Берётся текущий preset object из `openai_settings`.
- Если есть sensitive поля: confirm на их удаление.
- Затем popup `exportPreset`: по умолчанию стоит `Do not export connection data` (`value=false`).
- Если `export_connection_data=false`, удаляются все поля с `is_connection=true`.
- Эмитит `OAI_PRESET_EXPORT_READY` перед скачиванием.

8. Bind toggle:
- `bind_preset_to_connection` хранится в `oai_settings` и `settings.json`.
- В preset-файл не входит.

### 3.3 Формальные схемы UI API запросов пресетов

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "PresetSaveRequest.schema.json",
  "title": "PresetSaveRequest",
  "type": "object",
  "additionalProperties": false,
  "required": ["apiId", "name", "preset"],
  "properties": {
    "apiId": { "const": "openai" },
    "name": { "type": "string", "minLength": 1 },
    "preset": { "$ref": "#/$defs/ChatCompletionPresetFile" }
  },
  "$defs": {
    "ChatCompletionPresetFile": {
      "type": "object",
      "description": "См. отдельную схему ChatCompletionPresetFile ниже",
      "additionalProperties": true
    }
  }
}
```

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "PresetDeleteRequest.schema.json",
  "title": "PresetDeleteRequest",
  "type": "object",
  "additionalProperties": false,
  "required": ["apiId", "name"],
  "properties": {
    "apiId": { "const": "openai" },
    "name": { "type": "string", "minLength": 1 }
  }
}
```

## 4. Полная матрица параметров preset из settingsToUpdate

### 4.1 Нормативные правила матрицы

- Матрица ниже является публичным контрактом соответствия preset/runtime.
- `included_in_export`:
  - `yes` — экспортируется всегда (если поле вообще есть в объекте пресета).
  - `conditional (...)` — может быть удалено на этапе экспорта:
    - при `export_connection_data=false` удаляются все `is_connection=true`;
    - для sensitive полей дополнительно работает очистка через export confirm.
- `default` взят из `default_settings` (текстовое представление выражений из кода).

### 4.2 Машинно-читаемая матрица

```json
[
  {
    "preset_key": "chat_completion_source",
    "settings_key": "chat_completion_source",
    "selector": "#chat_completion_source",
    "type": "string|number|array",
    "is_connection": true,
    "default": "chat_completion_sources.OPENAI",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "temperature",
    "settings_key": "temp_openai",
    "selector": "#temp_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "1.0",
    "included_in_export": "yes"
  },
  {
    "preset_key": "frequency_penalty",
    "settings_key": "freq_pen_openai",
    "selector": "#freq_pen_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "0",
    "included_in_export": "yes"
  },
  {
    "preset_key": "presence_penalty",
    "settings_key": "pres_pen_openai",
    "selector": "#pres_pen_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "0",
    "included_in_export": "yes"
  },
  {
    "preset_key": "top_p",
    "settings_key": "top_p_openai",
    "selector": "#top_p_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "1.0",
    "included_in_export": "yes"
  },
  {
    "preset_key": "top_k",
    "settings_key": "top_k_openai",
    "selector": "#top_k_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "0",
    "included_in_export": "yes"
  },
  {
    "preset_key": "top_a",
    "settings_key": "top_a_openai",
    "selector": "#top_a_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "0",
    "included_in_export": "yes"
  },
  {
    "preset_key": "min_p",
    "settings_key": "min_p_openai",
    "selector": "#min_p_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "0",
    "included_in_export": "yes"
  },
  {
    "preset_key": "repetition_penalty",
    "settings_key": "repetition_penalty_openai",
    "selector": "#repetition_penalty_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "1",
    "included_in_export": "yes"
  },
  {
    "preset_key": "max_context_unlocked",
    "settings_key": "max_context_unlocked",
    "selector": "#oai_max_context_unlocked",
    "type": "boolean",
    "is_connection": false,
    "default": "false",
    "included_in_export": "yes"
  },
  {
    "preset_key": "openai_model",
    "settings_key": "openai_model",
    "selector": "#model_openai_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'gpt-4-turbo'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "claude_model",
    "settings_key": "claude_model",
    "selector": "#model_claude_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'claude-sonnet-4-5'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "openrouter_model",
    "settings_key": "openrouter_model",
    "selector": "#model_openrouter_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "openrouter_website_model",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "openrouter_use_fallback",
    "settings_key": "openrouter_use_fallback",
    "selector": "#openrouter_use_fallback",
    "type": "boolean",
    "is_connection": true,
    "default": "false",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "openrouter_group_models",
    "settings_key": "openrouter_group_models",
    "selector": "#openrouter_group_models",
    "type": "string|number|array",
    "is_connection": true,
    "default": "false",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "openrouter_sort_models",
    "settings_key": "openrouter_sort_models",
    "selector": "#openrouter_sort_models",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'alphabetically'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "openrouter_providers",
    "settings_key": "openrouter_providers",
    "selector": "#openrouter_providers_chat",
    "type": "string|number|array",
    "is_connection": true,
    "default": "[]",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "openrouter_quantizations",
    "settings_key": "openrouter_quantizations",
    "selector": "#openrouter_quantizations_chat",
    "type": "string|number|array",
    "is_connection": true,
    "default": "[]",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "openrouter_allow_fallbacks",
    "settings_key": "openrouter_allow_fallbacks",
    "selector": "#openrouter_allow_fallbacks",
    "type": "boolean",
    "is_connection": true,
    "default": "true",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "openrouter_middleout",
    "settings_key": "openrouter_middleout",
    "selector": "#openrouter_middleout",
    "type": "string|number|array",
    "is_connection": true,
    "default": "openrouter_middleout_types.ON",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "ai21_model",
    "settings_key": "ai21_model",
    "selector": "#model_ai21_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'jamba-large'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "mistralai_model",
    "settings_key": "mistralai_model",
    "selector": "#model_mistralai_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'mistral-large-latest'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "cohere_model",
    "settings_key": "cohere_model",
    "selector": "#model_cohere_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'command-r-plus'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "perplexity_model",
    "settings_key": "perplexity_model",
    "selector": "#model_perplexity_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'sonar-pro'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "groq_model",
    "settings_key": "groq_model",
    "selector": "#model_groq_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'llama-3.3-70b-versatile'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "chutes_model",
    "settings_key": "chutes_model",
    "selector": "#model_chutes_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'deepseek-ai/DeepSeek-V3-0324'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "chutes_sort_models",
    "settings_key": "chutes_sort_models",
    "selector": "#chutes_sort_models",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'alphabetically'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "siliconflow_model",
    "settings_key": "siliconflow_model",
    "selector": "#model_siliconflow_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'deepseek-ai/DeepSeek-V3'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "electronhub_model",
    "settings_key": "electronhub_model",
    "selector": "#model_electronhub_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'gpt-4o-mini'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "electronhub_sort_models",
    "settings_key": "electronhub_sort_models",
    "selector": "#electronhub_sort_models",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'alphabetically'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "electronhub_group_models",
    "settings_key": "electronhub_group_models",
    "selector": "#electronhub_group_models",
    "type": "string|number|array",
    "is_connection": true,
    "default": "false",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "nanogpt_model",
    "settings_key": "nanogpt_model",
    "selector": "#model_nanogpt_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'gpt-4o-mini'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "deepseek_model",
    "settings_key": "deepseek_model",
    "selector": "#model_deepseek_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'deepseek-chat'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "aimlapi_model",
    "settings_key": "aimlapi_model",
    "selector": "#model_aimlapi_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'chatgpt-4o-latest'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "xai_model",
    "settings_key": "xai_model",
    "selector": "#model_xai_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'grok-3-beta'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "pollinations_model",
    "settings_key": "pollinations_model",
    "selector": "#model_pollinations_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'openai'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "moonshot_model",
    "settings_key": "moonshot_model",
    "selector": "#model_moonshot_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'kimi-latest'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "fireworks_model",
    "settings_key": "fireworks_model",
    "selector": "#model_fireworks_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'accounts/fireworks/models/kimi-k2-instruct'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "cometapi_model",
    "settings_key": "cometapi_model",
    "selector": "#model_cometapi_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'gpt-4o'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "custom_model",
    "settings_key": "custom_model",
    "selector": "#custom_model_id",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "custom_url",
    "settings_key": "custom_url",
    "selector": "#custom_api_url_text",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "custom_include_body",
    "settings_key": "custom_include_body",
    "selector": "#custom_include_body",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "custom_exclude_body",
    "settings_key": "custom_exclude_body",
    "selector": "#custom_exclude_body",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "custom_include_headers",
    "settings_key": "custom_include_headers",
    "selector": "#custom_include_headers",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "custom_prompt_post_processing",
    "settings_key": "custom_prompt_post_processing",
    "selector": "#custom_prompt_post_processing",
    "type": "string|number|array",
    "is_connection": true,
    "default": "custom_prompt_post_processing_types.NONE",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "google_model",
    "settings_key": "google_model",
    "selector": "#model_google_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'gemini-2.5-pro'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "vertexai_model",
    "settings_key": "vertexai_model",
    "selector": "#model_vertexai_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'gemini-2.5-pro'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "zai_model",
    "settings_key": "zai_model",
    "selector": "#model_zai_select",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'glm-4.6'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "zai_endpoint",
    "settings_key": "zai_endpoint",
    "selector": "#zai_endpoint",
    "type": "string|number|array",
    "is_connection": true,
    "default": "ZAI_ENDPOINT.COMMON",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "openai_max_context",
    "settings_key": "openai_max_context",
    "selector": "#openai_max_context",
    "type": "string|number|array",
    "is_connection": false,
    "default": "max_4k",
    "included_in_export": "yes"
  },
  {
    "preset_key": "openai_max_tokens",
    "settings_key": "openai_max_tokens",
    "selector": "#openai_max_tokens",
    "type": "string|number|array",
    "is_connection": false,
    "default": "300",
    "included_in_export": "yes"
  },
  {
    "preset_key": "names_behavior",
    "settings_key": "names_behavior",
    "selector": "#names_behavior",
    "type": "string|number|array",
    "is_connection": false,
    "default": "character_names_behavior.DEFAULT",
    "included_in_export": "yes"
  },
  {
    "preset_key": "send_if_empty",
    "settings_key": "send_if_empty",
    "selector": "#send_if_empty_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "''",
    "included_in_export": "yes"
  },
  {
    "preset_key": "impersonation_prompt",
    "settings_key": "impersonation_prompt",
    "selector": "#impersonation_prompt_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_impersonation_prompt",
    "included_in_export": "yes"
  },
  {
    "preset_key": "new_chat_prompt",
    "settings_key": "new_chat_prompt",
    "selector": "#newchat_prompt_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_new_chat_prompt",
    "included_in_export": "yes"
  },
  {
    "preset_key": "new_group_chat_prompt",
    "settings_key": "new_group_chat_prompt",
    "selector": "#newgroupchat_prompt_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_new_group_chat_prompt",
    "included_in_export": "yes"
  },
  {
    "preset_key": "new_example_chat_prompt",
    "settings_key": "new_example_chat_prompt",
    "selector": "#newexamplechat_prompt_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_new_example_chat_prompt",
    "included_in_export": "yes"
  },
  {
    "preset_key": "continue_nudge_prompt",
    "settings_key": "continue_nudge_prompt",
    "selector": "#continue_nudge_prompt_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_continue_nudge_prompt",
    "included_in_export": "yes"
  },
  {
    "preset_key": "bias_preset_selected",
    "settings_key": "bias_preset_selected",
    "selector": "#openai_logit_bias_preset",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_bias",
    "included_in_export": "yes"
  },
  {
    "preset_key": "reverse_proxy",
    "settings_key": "reverse_proxy",
    "selector": "#openai_reverse_proxy",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "wi_format",
    "settings_key": "wi_format",
    "selector": "#wi_format_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_wi_format",
    "included_in_export": "yes"
  },
  {
    "preset_key": "scenario_format",
    "settings_key": "scenario_format",
    "selector": "#scenario_format_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_scenario_format",
    "included_in_export": "yes"
  },
  {
    "preset_key": "personality_format",
    "settings_key": "personality_format",
    "selector": "#personality_format_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_personality_format",
    "included_in_export": "yes"
  },
  {
    "preset_key": "group_nudge_prompt",
    "settings_key": "group_nudge_prompt",
    "selector": "#group_nudge_prompt_textarea",
    "type": "string|number|array",
    "is_connection": false,
    "default": "default_group_nudge_prompt",
    "included_in_export": "yes"
  },
  {
    "preset_key": "stream_openai",
    "settings_key": "stream_openai",
    "selector": "#stream_toggle",
    "type": "boolean",
    "is_connection": false,
    "default": "false",
    "included_in_export": "yes"
  },
  {
    "preset_key": "prompts",
    "settings_key": "prompts",
    "selector": "",
    "type": "object",
    "is_connection": false,
    "default": "<runtime/derived>",
    "included_in_export": "yes"
  },
  {
    "preset_key": "prompt_order",
    "settings_key": "prompt_order",
    "selector": "",
    "type": "object",
    "is_connection": false,
    "default": "<runtime/derived>",
    "included_in_export": "yes"
  },
  {
    "preset_key": "show_external_models",
    "settings_key": "show_external_models",
    "selector": "#openai_show_external_models",
    "type": "boolean",
    "is_connection": true,
    "default": "false",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "proxy_password",
    "settings_key": "proxy_password",
    "selector": "#openai_proxy_password",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "assistant_prefill",
    "settings_key": "assistant_prefill",
    "selector": "#claude_assistant_prefill",
    "type": "string|number|array",
    "is_connection": false,
    "default": "''",
    "included_in_export": "yes"
  },
  {
    "preset_key": "assistant_impersonation",
    "settings_key": "assistant_impersonation",
    "selector": "#claude_assistant_impersonation",
    "type": "string|number|array",
    "is_connection": false,
    "default": "''",
    "included_in_export": "yes"
  },
  {
    "preset_key": "use_sysprompt",
    "settings_key": "use_sysprompt",
    "selector": "#use_sysprompt",
    "type": "boolean",
    "is_connection": false,
    "default": "false",
    "included_in_export": "yes"
  },
  {
    "preset_key": "vertexai_auth_mode",
    "settings_key": "vertexai_auth_mode",
    "selector": "#vertexai_auth_mode",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'express'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "vertexai_region",
    "settings_key": "vertexai_region",
    "selector": "#vertexai_region",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'us-central1'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "vertexai_express_project_id",
    "settings_key": "vertexai_express_project_id",
    "selector": "#vertexai_express_project_id",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "squash_system_messages",
    "settings_key": "squash_system_messages",
    "selector": "#squash_system_messages",
    "type": "boolean",
    "is_connection": false,
    "default": "false",
    "included_in_export": "yes"
  },
  {
    "preset_key": "media_inlining",
    "settings_key": "media_inlining",
    "selector": "#openai_media_inlining",
    "type": "boolean",
    "is_connection": false,
    "default": "true",
    "included_in_export": "yes"
  },
  {
    "preset_key": "inline_image_quality",
    "settings_key": "inline_image_quality",
    "selector": "#openai_inline_image_quality",
    "type": "string|number|array",
    "is_connection": false,
    "default": "'auto'",
    "included_in_export": "yes"
  },
  {
    "preset_key": "continue_prefill",
    "settings_key": "continue_prefill",
    "selector": "#continue_prefill",
    "type": "boolean",
    "is_connection": false,
    "default": "false",
    "included_in_export": "yes"
  },
  {
    "preset_key": "continue_postfix",
    "settings_key": "continue_postfix",
    "selector": "#continue_postfix",
    "type": "string|number|array",
    "is_connection": false,
    "default": "continue_postfix_types.SPACE",
    "included_in_export": "yes"
  },
  {
    "preset_key": "function_calling",
    "settings_key": "function_calling",
    "selector": "#openai_function_calling",
    "type": "boolean",
    "is_connection": false,
    "default": "false",
    "included_in_export": "yes"
  },
  {
    "preset_key": "show_thoughts",
    "settings_key": "show_thoughts",
    "selector": "#openai_show_thoughts",
    "type": "boolean",
    "is_connection": false,
    "default": "true",
    "included_in_export": "yes"
  },
  {
    "preset_key": "reasoning_effort",
    "settings_key": "reasoning_effort",
    "selector": "#openai_reasoning_effort",
    "type": "string|number|array",
    "is_connection": false,
    "default": "reasoning_effort_types.auto",
    "included_in_export": "yes"
  },
  {
    "preset_key": "verbosity",
    "settings_key": "verbosity",
    "selector": "#openai_verbosity",
    "type": "string|number|array",
    "is_connection": false,
    "default": "verbosity_levels.auto",
    "included_in_export": "yes"
  },
  {
    "preset_key": "enable_web_search",
    "settings_key": "enable_web_search",
    "selector": "#openai_enable_web_search",
    "type": "boolean",
    "is_connection": false,
    "default": "false",
    "included_in_export": "yes"
  },
  {
    "preset_key": "seed",
    "settings_key": "seed",
    "selector": "#seed_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "-1",
    "included_in_export": "yes"
  },
  {
    "preset_key": "n",
    "settings_key": "n",
    "selector": "#n_openai",
    "type": "string|number|array",
    "is_connection": false,
    "default": "1",
    "included_in_export": "yes"
  },
  {
    "preset_key": "bypass_status_check",
    "settings_key": "bypass_status_check",
    "selector": "#openai_bypass_status_check",
    "type": "boolean",
    "is_connection": true,
    "default": "false",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "request_images",
    "settings_key": "request_images",
    "selector": "#openai_request_images",
    "type": "boolean",
    "is_connection": false,
    "default": "false",
    "included_in_export": "yes"
  },
  {
    "preset_key": "request_image_aspect_ratio",
    "settings_key": "request_image_aspect_ratio",
    "selector": "#request_image_aspect_ratio",
    "type": "string|number|array",
    "is_connection": false,
    "default": "''",
    "included_in_export": "yes"
  },
  {
    "preset_key": "request_image_resolution",
    "settings_key": "request_image_resolution",
    "selector": "#request_image_resolution",
    "type": "string|number|array",
    "is_connection": false,
    "default": "''",
    "included_in_export": "yes"
  },
  {
    "preset_key": "azure_base_url",
    "settings_key": "azure_base_url",
    "selector": "#azure_base_url",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "azure_deployment_name",
    "settings_key": "azure_deployment_name",
    "selector": "#azure_deployment_name",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "azure_api_version",
    "settings_key": "azure_api_version",
    "selector": "#azure_api_version",
    "type": "string|number|array",
    "is_connection": true,
    "default": "'2024-02-15-preview'",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "azure_openai_model",
    "settings_key": "azure_openai_model",
    "selector": "#azure_openai_model",
    "type": "string|number|array",
    "is_connection": true,
    "default": "''",
    "included_in_export": "conditional (removed when export_connection_data=false; may also be removed by sensitive export cleanup)"
  },
  {
    "preset_key": "extensions",
    "settings_key": "extensions",
    "selector": "#NULL_SELECTOR",
    "type": "object",
    "is_connection": false,
    "default": "{}",
    "included_in_export": "yes"
  }
]
```

## 5. Формат файла пресета

### 5.1 ChatCompletionPresetFile JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "ChatCompletionPresetFile.schema.json",
  "title": "ChatCompletionPresetFile",
  "type": "object",
  "additionalProperties": true,
  "description": "Имя пресета берётся из имени файла. Поле name (если есть) не используется для имени.",
  "properties": {
    "chat_completion_source": {
      "type": "string",
      "enum": [
        "openai", "claude", "openrouter", "ai21", "makersuite", "vertexai", "mistralai", "custom", "cohere", "perplexity", "groq", "chutes", "electronhub", "nanogpt", "deepseek", "aimlapi", "xai", "pollinations", "moonshot", "fireworks", "cometapi", "azure_openai", "zai", "siliconflow"
      ]
    },
    "prompts": { "type": "array" },
    "prompt_order": { "type": "array" },
    "extensions": { "type": "object" },
    "openrouter_providers": { "type": "array", "items": { "type": "string" } },
    "openrouter_quantizations": { "type": "array", "items": { "type": "string" } },
    "reverse_proxy": { "type": "string" },
    "proxy_password": { "type": "string" },
    "custom_url": { "type": "string" },
    "custom_include_body": { "type": "string" },
    "custom_exclude_body": { "type": "string" },
    "custom_include_headers": { "type": "string" },
    "bias_preset_selected": { "type": "string" },
    "reasoning_effort": { "type": "string" },
    "verbosity": { "type": "string" }
  }
}
```

### 5.2 Обязательные/опциональные поля и неизвестные поля

- Жёстко обязательных полей в файле нет; ST применяет только пересечение с `settingsToUpdate`.
- Неизвестные поля:
  - сохраняются на диск при import (`/api/presets/save` пишет объект как есть);
  - игнорируются при apply (не проходят по `settingsToUpdate`);
  - теряются после `Update/Save as`, так как сериализация идёт через `getChatCompletionPreset()` (только известные preset keys).

### 5.3 Критичные фиксированные правила

- `bind_preset_to_connection` не часть preset-файла (живёт в `oai_settings`/`settings.json`).
- `bias_presets` не входит в export Chat Completion preset; `bias_preset_selected` входит.
- Имя импортируемого пресета = basename файла (без расширения), не `json.name`.
- Сервер санитизирует имя через `sanitize-filename` и пишет `<name>.json`.

## 6. Sensitive/connection data правила

- Import sensitive flow:
  - `Import as-is` — sensitive поля остаются.
  - `Remove them` — sensitive поля удаляются до сохранения.
  - `Cancel import` — импорт прерывается.
- Export sensitive flow:
  - confirm перед export может удалить sensitive поля.
- Export connection flow:
  - в popup `exportPreset` по умолчанию включено `Do not export connection data`.
  - удаляются все поля, где `is_connection=true`.
- API keys не экспортируются: ключи хранятся в `secrets.json` и пишутся через secrets API, вне preset контракта.

## 7. Слои хранения: settings.json vs OpenAI Settings vs secrets

1. `settings.json`:
- Хранит runtime `oai_settings`, включая `bind_preset_to_connection`, `bias_presets`, selected preset name и прочие runtime значения.
- Пишется через `/api/settings/save`.

2. `OpenAI Settings/*.json`:
- Хранит отдельные preset files.
- Загружается через `/api/settings/get` как:
  - `openai_settings` — массив строк JSON (сырой file text);
  - `openai_setting_names` — массив имён файлов без `.json`.

3. `secrets.json`:
- Хранит API ключи/секреты (`SECRET_KEYS.*`).
- Не входит в preset export/import контракт.

### 7.1 SettingsGetResponse фрагмент (формальный контракт)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "SettingsGetResponse.OpenAIFragment.schema.json",
  "title": "SettingsGetResponse (OpenAI fragment)",
  "type": "object",
  "required": ["openai_settings", "openai_setting_names"],
  "properties": {
    "openai_settings": {
      "type": "array",
      "description": "Каждый элемент — JSON string содержимого preset файла",
      "items": { "type": "string" }
    },
    "openai_setting_names": {
      "type": "array",
      "description": "Имена файлов пресетов без расширения",
      "items": { "type": "string" }
    }
  },
  "additionalProperties": true
}
```

## 8. Жизненный цикл данных

Последовательность parity:

1. `GET settings`:
- `public/script.js:getSettings()` -> `/api/settings/get`.
- `loadOpenAISettings(data, settings.oai_settings ?? settings)`.

2. `loadOpenAISettings`:
- Парсинг `openai_settings[]` строк в объекты.
- Построение мапы `openai_setting_names`.
- Миграция runtime (`migrateChatCompletionSettings`), заполнение `oai_settings` из `default_settings`.

3. `select preset`:
- `onSettingsPresetChange()` применяет preset дельту в `oai_settings` (с учётом bind mode).

4. `mutate UI`:
- `input/change` обработчики меняют `oai_settings` и вызывают `saveSettingsDebounced()`.

5. `save settings`:
- `/api/settings/save` пишет `settings.json` (включая `oai_settings`).

6. `generation`:
- `createGenerationParameters(oai_settings, model, type, messages)`.
- `CHAT_COMPLETION_SETTINGS_READY` hook.
- POST `/api/backends/chat-completions/generate`.

## 9. Provider-логика payload (frontend + backend)

### 9.1 Frontend: createGenerationParameters

Базовый payload всегда стартует с полей: `type/messages/model/temperature/frequency_penalty/presence_penalty/top_p/max_tokens/stream/logit_bias/stop/chat_completion_source/n/include_reasoning/reasoning_effort/verbosity/...`.

Ключевые трансформации:

- OpenRouter: добавляет `top_k/min_p/repetition_penalty/top_a/use_fallback/provider/quantizations/allow_fallbacks/middleout`.
- Claude: `top_k/use_sysprompt/assistant_prefill`, отдельная stop стратегия.
- Custom: добавляет `custom_url/custom_include_body/custom_exclude_body/custom_include_headers`.
- Azure: добавляет `azure_base_url/azure_deployment_name/azure_api_version`.
- Cohere/Perplexity/Groq/DeepSeek/XAI/ElectronHub/Chutes/ZAI/NanoGPT/Moonshot: source-specific drop/map полей по коду.

Модельные capability-гейты:

- `o1/o3/o4` (OpenAI/Azure/OpenRouter-openai/*):
  - `max_tokens -> max_completion_tokens`;
  - удаляются `stop/logit_bias/logprobs/top_logprobs/temperature/top_p/frequency_penalty/presence_penalty`;
  - для `o1`: system role -> user, удаляются `n/tools/tool_choice`.

- `gpt-5*`:
  - `max_tokens -> max_completion_tokens`;
  - удаляются `logprobs/top_logprobs`;
  - дополнительные удаления зависят от подсемейства (`gpt-5-chat-latest`, `gpt-5.1/5.2`, прочие).

### 9.2 Backend: /generate

- Сначала optional post-processing (`custom_prompt_post_processing`) и `flattenSchema`.
- Для части источников отдельные handlers (`claude`, `makersuite/vertexai`, `ai21`, `mistralai`, `cohere`, `deepseek`, `xai`, `aimlapi`, `chutes`, `electronhub`, `azure_openai`).
- Для OpenAI-like ветки строится `requestBody` + source extensions:
  - OpenRouter: `transforms/plugins/provider/route/reasoning/verbosity/safety_settings`.
  - Custom: YAML merge/include (`custom_include_body`, `custom_include_headers`) + YAML exclude (`custom_exclude_body`).
  - Moonshot/ZAI/SiliconFlow: JSON mode через `setJsonObjectFormat` для schema.
  - OpenAI/Azure: map reasoning effort/verbosity по whitelist моделей.

### 9.3 Формальная схема GenerateRequest (ST internal contract)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "GenerateRequest.schema.json",
  "title": "GenerateRequest",
  "type": "object",
  "required": ["chat_completion_source", "model", "messages", "stream", "max_tokens"],
  "additionalProperties": true,
  "properties": {
    "chat_completion_source": {
      "type": "string",
      "enum": [
        "openai", "claude", "openrouter", "ai21", "makersuite", "vertexai", "mistralai", "custom", "cohere", "perplexity", "groq", "chutes", "electronhub", "nanogpt", "deepseek", "aimlapi", "xai", "pollinations", "moonshot", "fireworks", "cometapi", "azure_openai", "zai", "siliconflow"
      ]
    },
    "model": { "type": "string" },
    "messages": { "type": ["array", "string"] },
    "temperature": { "type": "number" },
    "top_p": { "type": "number" },
    "top_k": { "type": "number" },
    "frequency_penalty": { "type": "number" },
    "presence_penalty": { "type": "number" },
    "max_tokens": { "type": "number" },
    "max_completion_tokens": { "type": "number" },
    "stream": { "type": "boolean" },
    "stop": { "type": "array", "items": { "type": "string" } },
    "logit_bias": { "type": "object" },
    "logprobs": { "type": ["number", "boolean"] },
    "seed": { "type": "number" },
    "n": { "type": "number" },
    "tools": { "type": "array" },
    "tool_choice": { "type": ["string", "object"] },
    "reasoning_effort": { "type": "string" },
    "include_reasoning": { "type": "boolean" },
    "verbosity": { "type": "string" },
    "json_schema": { "type": "object" },
    "custom_prompt_post_processing": { "type": "string" },
    "enable_web_search": { "type": "boolean" },
    "request_images": { "type": "boolean" },
    "request_image_aspect_ratio": { "type": "string" },
    "request_image_resolution": { "type": "string" },
    "reverse_proxy": { "type": "string" },
    "proxy_password": { "type": "string" },
    "provider": { "type": "array", "items": { "type": "string" } },
    "quantizations": { "type": "array", "items": { "type": "string" } },
    "allow_fallbacks": { "type": "boolean" },
    "use_fallback": { "type": "boolean" },
    "middleout": { "type": "string" },
    "custom_url": { "type": "string" },
    "custom_include_body": { "type": "string" },
    "custom_exclude_body": { "type": "string" },
    "custom_include_headers": { "type": "string" },
    "azure_base_url": { "type": "string" },
    "azure_deployment_name": { "type": "string" },
    "azure_api_version": { "type": "string" },
    "vertexai_auth_mode": { "type": "string" },
    "vertexai_region": { "type": "string" },
    "vertexai_express_project_id": { "type": "string" },
    "zai_endpoint": { "type": "string", "enum": ["common", "coding"] }
  },
  "allOf": [
    {
      "if": { "properties": { "chat_completion_source": { "const": "custom" } }, "required": ["chat_completion_source"] },
      "then": { "required": ["custom_url"] }
    },
    {
      "if": { "properties": { "chat_completion_source": { "const": "azure_openai" } }, "required": ["chat_completion_source"] },
      "then": { "required": ["azure_base_url", "azure_deployment_name", "azure_api_version"] }
    },
    {
      "if": { "properties": { "chat_completion_source": { "const": "vertexai" } }, "required": ["chat_completion_source"] },
      "then": { "properties": { "vertexai_auth_mode": { "enum": ["express", "full"] } } }
    }
  ]
}
```

## 10. Legacy-миграции

### 10.1 migrateChatCompletionSettings

Миграции (frontend apply/load):
- `names_in_completion=true` -> `names_behavior=COMPLETION`.
- `chat_completion_source="palm"` -> `"makersuite"`.
- `custom_prompt_post_processing=claude` -> `merge`.
- `ai21_model` старые `j2-*` -> `jamba-large`.
- `image_inlining/video_inlining/audio_inlining` -> `media_inlining`.
- `claude_use_sysprompt` / `use_makersuite_sysprompt` -> `use_sysprompt`.
- `mistralai_model` старые имена -> `*-latest`.

### 10.2 PromptManager migration

- При `SETTINGS_LOADED_BEFORE` и `OAI_PRESET_CHANGED_BEFORE`:
  - legacy `main_prompt/nsfw_prompt/jailbreak_prompt` переносятся в `prompts[]`.
  - для preset apply может происходить `savePreset(...)` (кроме `Default`), но не гарантируется немедленная перезапись всех старых файлов.

Итог: legacy ключи могут оставаться в файлах до следующего save/update, это ожидаемое поведение.

## 11. Extension hooks/events

Нормативные события и смысл:

- `OAI_PRESET_CHANGED_BEFORE`:
  - payload: `{ preset, presetName, settingsToUpdate, settings, savePreset, presetNameBefore }`.
  - можно модифицировать `preset` перед применением.

- `OAI_PRESET_CHANGED_AFTER`:
  - после фактического apply + saveSettingsDebounced.

- `OAI_PRESET_IMPORT_READY`:
  - перед `/api/presets/save` из import.
  - payload: `{ data, presetName }`.

- `OAI_PRESET_EXPORT_READY`:
  - перед download export JSON.
  - payload: `preset object` (может быть модифицирован listener'ом).

- `CHAT_COMPLETION_SETTINGS_READY`:
  - перед POST `/generate`.
  - payload: `generate_data`.

- `PRESET_CHANGED`:
  - общий сигнал смены пресета `{ apiId: 'openai', name }`.
  - используется extension-ами (пример: regex preset scripts via `extensions` поля).

Влияние `extensions`:
- `extensions` входит в preset export/import.
- `extensions.regex_scripts` и аналогичные extension-данные применяются косвенно через listeners (`PRESET_CHANGED`) и могут требовать reload чата для полного эффекта.

## 12. Ограничения parity (preset-only)

Preset-файла недостаточно для бит-в-бит поведения без runtime зависимостей:

- нет API ключей/секретов (`secrets.json` вне контракта);
- нет `bind_preset_to_connection` (в `settings.json`);
- нет `bias_presets` (только `bias_preset_selected`);
- нет `power_user` зависимостей (custom stop strings, request token probabilities и т.д.);
- нет model list/capability state от `/status`;
- нет extension runtime permission/state (например, разрешение embedded regex scripts);
- нет текущего chat/character context, влияющего на prompt manager и финальный prompt.

## 13. Набор тест-векторов и чек-лист приёмки

### 13.1 Реальные тест-векторы

1. **Vector A: Default preset (реальный)**
- Источник: `default/content/presets/openai/Default.json`.
- Минимальный фрагмент:

```json
{
  "chat_completion_source": "openai",
  "openai_model": "gpt-4-turbo",
  "temperature": 1,
  "top_p": 1,
  "openai_max_context": 4095,
  "openai_max_tokens": 300,
  "bias_preset_selected": "Default (none)",
  "stream_openai": true,
  "prompts": ["..."],
  "prompt_order": ["..."],
  "extensions": {}
}
```

2. **Vector B: Legacy custom preset (реальный, санитизированный)**
- Основан на реальных user preset файлах из `data/default-user/OpenAI Settings/*.json`.
- Ключи legacy + custom connection:

```json
{
  "chat_completion_source": "custom",
  "custom_model": "claude-opus-4-5-20251101",
  "custom_url": "https://example-proxy.local/v1",
  "custom_include_headers": "X-Test: 1",
  "image_inlining": false,
  "video_inlining": true,
  "audio_inlining": false,
  "claude_use_sysprompt": false,
  "use_makersuite_sysprompt": false,
  "reasoning_effort": "auto",
  "extensions": {}
}
```

- Ожидание после apply:
  - `media_inlining=true` если любой из legacy media-флагов true, иначе false;
  - `use_sysprompt` мигрирован;
  - legacy ключи игнорируются/удаляются миграцией в runtime.

3. **Vector C: Export without connection data (реальный сценарий UI)**

```json
{
  "chat_completion_source": "openai",
  "temperature": 0.8,
  "openai_max_tokens": 1024,
  "prompts": [],
  "prompt_order": [],
  "extensions": {}
}
```

- Ожидание: отсутствуют все `is_connection=true` поля (`openai_model`, `custom_url`, `reverse_proxy`, `azure_*`, `vertexai_*`, ...).

### 13.2 Обязательные тест-сценарии parity

1. Round-trip: export из ST -> import в ST -> бинарное сравнение нормализованного объекта.
2. Import с sensitive полями: `Import as-is` vs `Remove them`.
3. Export без connection data: verify удаление всех `is_connection`.
4. Legacy preset (`image_inlining`, `claude_use_sysprompt`, `names_in_completion`) -> apply -> ожидаемый runtime.
5. `chat_completion_source=custom` + YAML include/exclude headers/body -> корректный `GenerateRequest`.
6. `bind_preset_to_connection=false` -> connection-поля не применяются.
7. `bind_preset_to_connection=true` -> connection-поля применяются и триггерят source/model refresh.
8. Capability cases: `o1/o3/o4/gpt-5` трансформации (`max_completion_tokens`, удаление unsupported полей).
9. Preset-only импорт без runtime deps даёт отличный output — фиксируется как ограничение.

### 13.3 Нормализация для сравнения (рекомендуемая)

- Parse JSON -> рекурсивная сортировка ключей -> `JSON.stringify(obj, null, 4)`.
- Для сценариев с опциями экспорта дополнительно применить те же delete-правила (`sensitive`, `is_connection`).
- Сравнение выполнять по UTF-8 байтам результата.

### 13.4 Чек-лист приёмки документа

- Каждый ключ `settingsToUpdate` присутствует в матрице раздела 4.
- Описаны все UI действия из блока `Chat Completion Presets`.
- Описаны серверные endpoints preset lifecycle.
- Формально описан путь до `generate` payload и provider/model трансформации.
- Приведены минимум 3 реальные test-вектора.
- Документ достаточен для реализации совместимого импорта без дополнительных догадок.
