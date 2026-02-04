import { Autocomplete, Button, Group, Input, Select, Stack, Text, TextInput } from "@mantine/core";
import { useUnit } from "effector-react";
import { useEffect, useMemo, useState } from "react";

import { llmProviderModel } from "@model/provider";

import { TokenManager } from "./token-manager";

import type { LlmProviderConfig, LlmProviderId, LlmScope } from "@shared/types/llm";

type SelectOption = { value: string; label: string };

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

  const enabledProviders = useMemo(
    () =>
      providers.filter((p) => {
        const maybe = p as unknown as { id?: unknown; enabled?: unknown };
        return typeof maybe?.id === "string" && Boolean(maybe?.enabled);
      }),
    [providers]
  );

  const providerOptions: SelectOption[] = useMemo(
    () =>
      enabledProviders
        .map((p) => {
          const maybe = p as unknown as { id?: unknown; name?: unknown };
          const value = typeof maybe?.id === "string" ? maybe.id : "";
          const label = typeof maybe?.name === "string" ? maybe.name : value;
          return value ? ({ value, label } satisfies SelectOption) : null;
        })
        .filter((v): v is SelectOption => Boolean(v)),
    [enabledProviders]
  );

  const tokens = tokensByProvider[activeProviderId] ?? [];
  const tokenOptions: SelectOption[] = useMemo(
    () =>
      tokens
        .map((t) => {
          const maybe = t as unknown as { id?: unknown; name?: unknown; tokenHint?: unknown };
          const value = typeof maybe?.id === "string" ? maybe.id : "";
          const name = typeof maybe?.name === "string" ? maybe.name : "Token";
          const hint = typeof maybe?.tokenHint === "string" ? maybe.tokenHint : "";
          const label = hint ? `${name} (${hint})` : name;
          return value ? ({ value, label } satisfies SelectOption) : null;
        })
        .filter((v): v is SelectOption => Boolean(v)),
    [tokens]
  );

  const modelsKey = `${activeProviderId}:${activeTokenId ?? "none"}`;
  const models = modelsByKey[modelsKey] ?? [];
  const modelOptions: SelectOption[] = useMemo(
    () =>
      models
        .map((m) => {
          const maybe = m as unknown as { id?: unknown; name?: unknown };
          const value = typeof maybe?.id === "string" ? maybe.id : "";
          const label = typeof maybe?.name === "string" ? maybe.name : value;
          return value ? ({ value, label } satisfies SelectOption) : null;
        })
        .filter((v): v is SelectOption => Boolean(v)),
    [models]
  );

  const providerConfig = useMemo<LlmProviderConfig>(
    () => configByProvider[activeProviderId] ?? {},
    [configByProvider, activeProviderId]
  );
  const [configDraft, setConfigDraft] = useState<LlmProviderConfig>({});
  const [modelInput, setModelInput] = useState("");

  useEffect(() => {
    if (activeProviderId === "openai_compatible") {
      setConfigDraft({ baseUrl: "", ...providerConfig });
      return;
    }
    setConfigDraft(providerConfig);
  }, [providerConfig, activeProviderId]);

  useEffect(() => {
    setModelInput(activeModel ?? "");
  }, [activeModel]);

  const saveConfig = async () => {
    await patchProviderConfigFx({ providerId: activeProviderId, config: configDraft });
    await loadProviderConfigFx(activeProviderId);
  };

  const canLoadModels = Boolean(activeTokenId);

  const loadModels = async () => {
    if (!canLoadModels) return;
    await loadModelsFx({ providerId: activeProviderId, scope, scopeId, tokenId: activeTokenId });
  };

  const modelAutocompleteData = useMemo(() => {
    // Autocomplete items are plain strings; include both name and id when they differ.
    return modelOptions.map((o) => (o.label === o.value ? o.value : `${o.label} — ${o.value}`));
  }, [modelOptions]);

  const resolveModelIdFromAutocompleteValue = (value: string): string => {
    const trimmed = value.trim();
    const direct = modelOptions.find((o) => o.value === trimmed || o.label === trimmed);
    if (direct) return direct.value;

    const match = trimmed.match(/\s—\s(.+)$/);
    if (match) {
      const id = match[1].trim();
      const exists = modelOptions.some((o) => o.value === id);
      if (exists) return id;
    }

    // Allow custom model id input (e.g., when models list isn't loaded).
    return trimmed;
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
          comboboxProps={{ withinPortal: false }}
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
          comboboxProps={{ withinPortal: false }}
        />
        <TokenManager providerId={activeProviderId} scope={scope} scopeId={scopeId} />
      </Stack>

      <Stack gap="sm">
        <Text fw={600}>Provider config</Text>

        {activeProviderId === "openai_compatible" && (
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

        <Autocomplete
          data={modelAutocompleteData}
          value={modelInput}
          onChange={(value) => {
            setModelInput(value);
            if (value === "") {
              selectModel({ scope, scopeId, model: null });
            }
          }}
          onOptionSubmit={(value) => {
            setModelInput(value);
            const modelId = resolveModelIdFromAutocompleteValue(value);
            selectModel({ scope, scopeId, model: modelId || null });
          }}
          onBlur={() => {
            const modelId = resolveModelIdFromAutocompleteValue(modelInput);
            selectModel({ scope, scopeId, model: modelId || null });
          }}
          placeholder={canLoadModels ? "Select model..." : "Select token first"}
          disabled={!canLoadModels}
          comboboxProps={{ withinPortal: false }}
        />

        <Text size="sm" c="dimmed">
          Если модель не выбрана, будет использоваться `defaultModel` провайдера (если задан) или дефолт провайдера.
        </Text>
      </Stack>
    </Stack>
  );
};

