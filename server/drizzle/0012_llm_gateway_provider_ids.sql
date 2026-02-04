-- Rename runtime provider id: custom_openai -> openai_compatible (to match llm-gateway)
--
-- We cannot UPDATE llm_providers.id in-place because FKs use `ON UPDATE no action`.
-- Instead we:
-- 1) create the new provider row (if needed)
-- 2) repoint dependent rows
-- 3) delete the old provider row

-- 1) Create openai_compatible provider row (copy metadata from custom_openai when present)
INSERT OR IGNORE INTO `llm_providers` (`id`, `name`, `enabled`, `created_at`, `updated_at`)
SELECT
  'openai_compatible' AS `id`,
  `name`,
  `enabled`,
  `created_at`,
  `updated_at`
FROM `llm_providers`
WHERE `id` = 'custom_openai';
--> statement-breakpoint

-- 2) Provider config: copy -> new id, then remove old row
INSERT OR IGNORE INTO `llm_provider_configs` (`id`, `provider_id`, `config_json`, `created_at`, `updated_at`)
SELECT
  'openai_compatible' AS `id`,
  'openai_compatible' AS `provider_id`,
  `config_json`,
  `created_at`,
  `updated_at`
FROM `llm_provider_configs`
WHERE `id` = 'custom_openai';
--> statement-breakpoint

DELETE FROM `llm_provider_configs` WHERE `id` = 'custom_openai';
--> statement-breakpoint

-- 3) Tokens
UPDATE `llm_tokens`
SET `provider_id` = 'openai_compatible'
WHERE `provider_id` = 'custom_openai';
--> statement-breakpoint

-- 4) Runtime settings
UPDATE `llm_runtime_settings`
SET `active_provider_id` = 'openai_compatible'
WHERE `active_provider_id` = 'custom_openai';
--> statement-breakpoint

-- 5) Provider-scoped runtime state: merge if needed, then delete old rows
INSERT OR IGNORE INTO `llm_runtime_provider_state` (
  `scope`,
  `scope_id`,
  `provider_id`,
  `last_token_id`,
  `last_model`,
  `updated_at`
)
SELECT
  s.`scope`,
  s.`scope_id`,
  'openai_compatible' AS `provider_id`,
  s.`last_token_id`,
  s.`last_model`,
  s.`updated_at`
FROM `llm_runtime_provider_state` s
WHERE s.`provider_id` = 'custom_openai'
  AND NOT EXISTS (
    SELECT 1
    FROM `llm_runtime_provider_state` t
    WHERE t.`scope` = s.`scope`
      AND t.`scope_id` = s.`scope_id`
      AND t.`provider_id` = 'openai_compatible'
  );
--> statement-breakpoint

DELETE FROM `llm_runtime_provider_state` WHERE `provider_id` = 'custom_openai';
--> statement-breakpoint

-- 6) Historical generations (no FK, but keep data consistent)
UPDATE `llm_generations`
SET `provider_id` = 'openai_compatible'
WHERE `provider_id` = 'custom_openai';
--> statement-breakpoint

-- 7) Remove old provider row (after all references were repointed)
DELETE FROM `llm_providers` WHERE `id` = 'custom_openai';

