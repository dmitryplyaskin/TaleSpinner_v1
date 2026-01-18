import { Button, Group, Input, Select, Stack, Text, TextInput } from "@mantine/core";
import { useUnit } from "effector-react";
import { useEffect, useMemo, useState } from "react";

import { llmProviderModel } from "@model/provider";

import { TokenManager } from "./token-manager";

import type { LlmProviderConfig, LlmProviderId, LlmScope } from "@shared/types/llm";

type Props = {
  scope: LlmScope;
  scopeId: string;
};

export const ProviderPicker: React.FC<Props> = ({ scope, scopeId }) => {
  const [
    providers,
    runtimeByKey,
    tokensByProvider,
    modelsByKey,
    configByProvider,
    mounted,
    selectProvider,
    selectToken,
    selectModel,
    openTokenManager,
    loadModelsFx,
    patchProviderConfigFx,
    loadProviderConfigFx,
  ] = useUnit([
    llmProviderModel.$providers,
    llmProviderModel.$runtimeByScopeKey,
    llmProviderModel.$tokensByProviderId,
    llmProviderModel.$modelsByProviderTokenKey,
    llmProviderModel.$providerConfigById,
    llmProviderModel.providerPickerMounted,
    llmProviderModel.providerSelected,
    llmProviderModel.tokenSelected,
    llmProviderModel.modelSelected,
    llmProviderModel.tokenManagerOpened,
    llmProviderModel.loadModelsFx,
    llmProviderModel.patchProviderConfigFx,
    llmProviderModel.loadProviderConfigFx,
  ]);

  const scopeKey = `${scope}:${scopeId}` as const;
  const runtime = runtimeByKey[scopeKey];
  const activeProviderId = runtime?.activeProviderId ?? "openrouter";
  const activeTokenId = runtime?.activeTokenId ?? null;
  const activeModel = runtime?.activeModel ?? null;

  useEffect(() => {
    mounted({ scope, scopeId });
  }, [mounted, scope, scopeId]);

  const enabledProviders = useMemo(() => providers.filter((p) => p.enabled), [providers]);

  const providerOptions = enabledProviders.map((p) => ({ value: p.id, label: p.name }));

  const tokens = tokensByProvider[activeProviderId] ?? [];
  const tokenOptions = tokens.map((t) => ({ value: t.id, label: `${t.name} (${t.tokenHint})` }));

  const modelsKey = `${activeProviderId}:${activeTokenId ?? "none"}`;
  const models = modelsByKey[modelsKey] ?? [];
  const modelOptions = models.map((m) => ({ value: m.id, label: m.name }));

  const providerConfig = useMemo<LlmProviderConfig>(
    () => configByProvider[activeProviderId] ?? {},
    [configByProvider, activeProviderId]
  );
  const [configDraft, setConfigDraft] = useState<LlmProviderConfig>({});

  useEffect(() => {
    if (activeProviderId === "custom_openai") {
      setConfigDraft({ baseUrl: "", ...providerConfig });
      return;
    }
    setConfigDraft(providerConfig);
  }, [providerConfig, activeProviderId]);

  const saveConfig = async () => {
    await patchProviderConfigFx({ providerId: activeProviderId, config: configDraft });
    await loadProviderConfigFx(activeProviderId);
  };

  const canLoadModels = Boolean(activeTokenId);

  const loadModels = async () => {
    if (!canLoadModels) return;
    await loadModelsFx({ providerId: activeProviderId, scope, scopeId, tokenId: activeTokenId });
  };

  return (
    <Stack gap="lg">
      <Input.Wrapper label="API provider">
        <Select
          data={providerOptions}
          value={activeProviderId}
          onChange={(value) => {
            const providerId = (value ?? "openrouter") as LlmProviderId;
            selectProvider({ scope, scopeId, providerId });
          }}
          placeholder="Select provider..."
          searchable
        />
      </Input.Wrapper>

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>Tokens</Text>
          <Button size="xs" variant="outline" onClick={() => openTokenManager(true)}>
            Manage tokens
          </Button>
        </Group>

        <Select
          data={tokenOptions}
          value={activeTokenId}
          onChange={(value) => selectToken({ scope, scopeId, tokenId: value ?? null })}
          placeholder={tokens.length ? "Select token..." : "No tokens"}
          clearable
          searchable
        />
        <TokenManager providerId={activeProviderId} scope={scope} scopeId={scopeId} />
      </Stack>

      <Stack gap="sm">
        <Text fw={600}>Provider config</Text>

        {activeProviderId === "custom_openai" && (
          <TextInput
            label="Base URL"
            value={String(configDraft.baseUrl ?? "")}
            onChange={(e) => setConfigDraft((s) => ({ ...s, baseUrl: e.currentTarget.value }))}
            placeholder="http://localhost:1234/v1"
          />
        )}

        <TextInput
          label="Default model (optional)"
          value={String(configDraft.defaultModel ?? "")}
          onChange={(e) => setConfigDraft((s) => ({ ...s, defaultModel: e.currentTarget.value }))}
          placeholder="gpt-4o-mini"
        />

        <Group justify="flex-end">
          <Button size="xs" variant="outline" onClick={saveConfig}>
            Save config
          </Button>
        </Group>
      </Stack>

      <Stack gap="xs">
        <Group justify="space-between">
          <Text fw={600}>Model</Text>
          <Button size="xs" variant="outline" onClick={loadModels} disabled={!canLoadModels}>
            Load models
          </Button>
        </Group>

        <Select
          data={modelOptions}
          value={activeModel}
          onChange={(value) => selectModel({ scope, scopeId, model: value ?? null })}
          placeholder={canLoadModels ? "Select model..." : "Select token first"}
          clearable
          searchable
        />

        <Text size="sm" c="dimmed">
          Если модель не выбрана, будет использоваться `defaultModel` провайдера (если задан) или дефолт провайдера.
        </Text>
      </Stack>
    </Stack>
  );
};

