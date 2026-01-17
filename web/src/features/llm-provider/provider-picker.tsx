import { Button, HStack, Input, Stack, Text, VStack } from "@chakra-ui/react";
import { Select } from "chakra-react-select";
import { useUnit } from "effector-react";
import { useEffect, useMemo, useState } from "react";

import { llmProviderModel } from "@model/provider";
import { Field } from "@ui/chakra-core-ui/field";

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
    <VStack gap={4} align="stretch">
      <Field label="API provider">
        <Select
          options={providerOptions}
          value={providerOptions.find((o) => o.value === activeProviderId) ?? null}
          onChange={(opt) => {
            const providerId = (opt?.value ?? "openrouter") as LlmProviderId;
            selectProvider({ scope, scopeId, providerId });
          }}
          placeholder="Select provider..."
        />
      </Field>

      <Stack gap={2}>
        <HStack justify="space-between">
          <Text fontWeight="semibold">Tokens</Text>
          <Button size="sm" variant="outline" onClick={() => openTokenManager(true)}>
            Manage tokens
          </Button>
        </HStack>
        <Select
          options={tokenOptions}
          value={tokenOptions.find((o) => o.value === activeTokenId) ?? null}
          onChange={(opt) => {
            selectToken({ scope, scopeId, tokenId: (opt?.value ?? null) as string | null });
          }}
          placeholder={tokens.length ? "Select token..." : "No tokens"}
          isClearable
        />
        <TokenManager providerId={activeProviderId} scope={scope} scopeId={scopeId} />
      </Stack>

      <Stack gap={3} mt={2}>
        <Text fontWeight="semibold">Provider config</Text>

        {activeProviderId === "custom_openai" && (
          <Field label="Base URL">
            <Input
              value={String(configDraft.baseUrl ?? "")}
              onChange={(e) => setConfigDraft((s) => ({ ...s, baseUrl: e.target.value }))}
              placeholder="http://localhost:1234/v1"
            />
          </Field>
        )}

        <Field label="Default model (optional)">
          <Input
            value={String(configDraft.defaultModel ?? "")}
            onChange={(e) => setConfigDraft((s) => ({ ...s, defaultModel: e.target.value }))}
            placeholder="gpt-4o-mini"
          />
        </Field>

        <HStack justify="flex-end">
          <Button size="sm" variant="outline" onClick={saveConfig}>
            Save config
          </Button>
        </HStack>
      </Stack>

      <Stack gap={2} mt={2}>
        <HStack justify="space-between">
          <Text fontWeight="semibold">Model</Text>
          <Button size="sm" variant="outline" onClick={loadModels} disabled={!canLoadModels}>
            Load models
          </Button>
        </HStack>

        <Select
          options={modelOptions}
          value={modelOptions.find((o) => o.value === activeModel) ?? null}
          onChange={(opt) => selectModel({ scope, scopeId, model: (opt?.value ?? null) as string | null })}
          placeholder={canLoadModels ? "Select model..." : "Select token first"}
          isClearable
        />

        <Text fontSize="sm" opacity={0.75}>
          Если модель не выбрана, будет использоваться `defaultModel` провайдера (если задан) или дефолт провайдера.
        </Text>
      </Stack>
    </VStack>
  );
};

