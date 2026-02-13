import { Button, Divider, Flex, Group, Input, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuPencil, LuPlus, LuSave, LuTrash2 } from 'react-icons/lu';

import { ragProviderModel } from '@model/rag-provider';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

import type { RagProviderConfig, RagProviderId } from '@shared/types/rag';

export const RagSettingsTab = () => {
  const { t } = useTranslation();
  const [providers, runtime, configs, tokens, presets, presetSettings] = useUnit([
    ragProviderModel.$providers,
    ragProviderModel.$runtime,
    ragProviderModel.$configs,
    ragProviderModel.$tokens,
    ragProviderModel.$presets,
    ragProviderModel.$presetSettings,
  ]);

  const [configDraft, setConfigDraft] = useState<RagProviderConfig>({});

  useEffect(() => {
    ragProviderModel.ragMounted();
  }, []);

  const activeProviderId = runtime?.activeProviderId ?? 'openrouter';
  const activeConfig = configs[activeProviderId] ?? {};

  useEffect(() => {
    setConfigDraft(activeConfig);
  }, [activeProviderId, activeConfig]);

  const activeTokens = tokens[activeProviderId] ?? [];

  const providerOptions = providers.map((x) => ({ value: x.id, label: x.name }));
  const tokenOptions = activeTokens.map((x) => ({ value: x.id, label: `${x.name} (${x.tokenHint})` }));

  const presetOptions = presets.map((x) => ({ value: x.id, label: x.name }));
  const activePresetId = presetSettings?.selectedId ?? null;
  const activePreset = presets.find((x) => x.id === activePresetId) ?? null;

  const activeProvider = useMemo(() => providers.find((item) => item.id === activeProviderId), [providers, activeProviderId]);

  const buildPayload = () => ({
    activeProviderId,
    activeTokenId: runtime?.activeTokenId ?? null,
    activeModel: runtime?.activeModel ?? null,
    providerConfigsById: {
      openrouter: configs.openrouter ?? {},
      ollama: configs.ollama ?? {},
    },
  });

  const saveConfig = async () => {
    try {
      await ragProviderModel.patchConfigFx({ providerId: activeProviderId, config: configDraft });
      toaster.success({ title: t('rag.toasts.configSaved') });
    } catch (error) {
      toaster.error({ title: t('rag.toasts.configSaveFailed'), description: error instanceof Error ? error.message : String(error) });
    }
  };

  const createPreset = async () => {
    const name = window.prompt(t('rag.presets.actions.createPrompt'), t('rag.presets.defaults.newPresetName'))?.trim();
    if (!name) return;
    const created = await ragProviderModel.createPresetFx({ name, payload: buildPayload() });
    await ragProviderModel.patchPresetSettingsFx({ enabled: true, selectedId: created.id });
  };

  const renamePreset = async () => {
    if (!activePreset) return;
    const name = window.prompt(t('rag.presets.actions.renamePrompt'), activePreset.name)?.trim();
    if (!name) return;
    await ragProviderModel.updatePresetFx({ ...activePreset, name });
  };

  const savePreset = async () => {
    if (!activePreset) return;
    await ragProviderModel.updatePresetFx({ ...activePreset, payload: buildPayload() });
  };

  const duplicatePreset = async () => {
    if (!activePreset) return;
    await ragProviderModel.createPresetFx({ name: `${activePreset.name} copy`, payload: activePreset.payload });
  };

  const deletePreset = async () => {
    if (!activePreset) return;
    if (!window.confirm(t('rag.presets.confirm.delete'))) return;
    await ragProviderModel.deletePresetFx(activePreset.id);
    await ragProviderModel.patchPresetSettingsFx({ enabled: true, selectedId: null });
  };

  const applyPreset = async () => {
    if (!activePresetId) return;
    await ragProviderModel.applyPresetFx(activePresetId);
  };

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Text fw={600}>{t('rag.presets.title')}</Text>
        <Group align="flex-end">
          <Select
            style={{ flex: 1 }}
            label={t('rag.presets.active')}
            data={presetOptions}
            value={activePresetId}
            onChange={(value) => {
              if (!presetSettings) return;
              void ragProviderModel.patchPresetSettingsFx({ ...presetSettings, selectedId: value ?? null });
            }}
            comboboxProps={{ withinPortal: false }}
          />
          <Group gap="xs" pb={4}>
            <IconButtonWithTooltip icon={<LuPlus />} tooltip={t('rag.presets.actions.create')} onClick={() => void createPreset()} />
            <IconButtonWithTooltip icon={<LuPencil />} tooltip={t('rag.presets.actions.rename')} onClick={() => void renamePreset()} disabled={!activePreset} />
            <IconButtonWithTooltip icon={<LuSave />} tooltip={t('rag.presets.actions.save')} onClick={() => void savePreset()} disabled={!activePreset} />
            <IconButtonWithTooltip icon={<LuCopy />} tooltip={t('rag.presets.actions.duplicate')} onClick={() => void duplicatePreset()} disabled={!activePreset} />
            <IconButtonWithTooltip icon={<LuTrash2 />} tooltip={t('rag.presets.actions.delete')} onClick={() => void deletePreset()} disabled={!activePreset} />
          </Group>
        </Group>
        <Button variant="light" size="xs" onClick={() => void applyPreset()} disabled={!activePresetId}>{t('rag.presets.actions.apply')}</Button>
      </Stack>

      <Divider />

      <Input.Wrapper label={t('rag.providerLabel')}>
        <Select data={providerOptions} value={activeProviderId} onChange={(v) => ragProviderModel.ragProviderSelected((v ?? 'openrouter') as RagProviderId)} comboboxProps={{ withinPortal: false }} />
      </Input.Wrapper>

      {activeProviderId === 'openrouter' && (
        <Input.Wrapper label={t('rag.tokens.title')}>
          <Select data={tokenOptions} value={runtime?.activeTokenId ?? null} onChange={(v) => ragProviderModel.ragTokenSelected(v ?? null)} comboboxProps={{ withinPortal: false }} clearable />
        </Input.Wrapper>
      )}

      <TextInput label={t('rag.model.manual')} value={runtime?.activeModel ?? ''} onChange={(e) => ragProviderModel.ragModelSelected(e.currentTarget.value || null)} placeholder={t('rag.model.manualPlaceholder')} />

      <Text fw={600}>{t('rag.config.title')}</Text>

      {activeProvider?.configFields.map((field) => {
        if (field.type === 'select') {
          return (
            <Select
              key={field.key}
              label={field.label}
              data={field.options ?? []}
              value={typeof configDraft[field.key] === 'string' ? (configDraft[field.key] as string) : null}
              onChange={(v) => setConfigDraft((prev) => ({ ...prev, [field.key]: v }))}
              comboboxProps={{ withinPortal: false }}
            />
          );
        }

        if (field.key === 'truncate') {
          return (
            <Switch
              key={field.key}
              label={field.label}
              checked={Boolean(configDraft[field.key])}
              onChange={(event) => setConfigDraft((prev) => ({ ...prev, [field.key]: event.currentTarget.checked }))}
            />
          );
        }

        return (
          <TextInput
            key={field.key}
            label={field.label}
            type={field.type === 'number' ? 'number' : 'text'}
            value={String(configDraft[field.key] ?? '')}
            placeholder={field.placeholder}
            onChange={(event) => setConfigDraft((prev) => ({ ...prev, [field.key]: field.type === 'number' ? Number(event.currentTarget.value || 0) : event.currentTarget.value }))}
          />
        );
      })}

      <Flex justify="flex-end">
        <Button variant="outline" onClick={() => void saveConfig()}>{t('rag.config.save')}</Button>
      </Flex>
    </Stack>
  );
};
