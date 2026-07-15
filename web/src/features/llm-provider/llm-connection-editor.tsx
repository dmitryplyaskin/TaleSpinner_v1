import { Button, Group, Input, Select, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuKeyRound, LuSearch } from 'react-icons/lu';

import { LlmModelPickerDialog } from './llm-model-picker-dialog';
import { getModelMetadata } from './llm-model-utils';
import { LlmTokenManagerDialog } from './llm-token-manager-dialog';

import type {
	LlmModel,
	LlmProviderConfig,
	LlmProviderDefinition,
	LlmProviderId,
	LlmTokenListItem,
} from '@shared/types/llm';

type Props = {
	providers: LlmProviderDefinition[];
	providerId: LlmProviderId;
	tokens: LlmTokenListItem[];
	tokenId: string | null;
	models: LlmModel[];
	modelId: string | null;
	config: LlmProviderConfig;
	isLoadingModels: boolean;
	isChecking: boolean;
	onProviderChange: (providerId: LlmProviderId) => Promise<void>;
	onTokenChange: (tokenId: string | null) => Promise<void>;
	onModelChange: (modelId: string) => Promise<void>;
	onConfigChange: (config: LlmProviderConfig) => void;
	onRefreshModels: () => Promise<void>;
	onCheckConnection: () => Promise<void>;
};

export const LlmConnectionEditor: React.FC<Props> = ({
	providers,
	providerId,
	tokens,
	tokenId,
	models,
	modelId,
	config,
	isLoadingModels,
	isChecking,
	onProviderChange,
	onTokenChange,
	onModelChange,
	onConfigChange,
	onRefreshModels,
	onCheckConnection,
}) => {
	const { t } = useTranslation();
	const [tokenManagerOpen, setTokenManagerOpen] = useState(false);
	const [modelPickerOpen, setModelPickerOpen] = useState(false);
	const activeProvider = providers.find((provider) => provider.id === providerId);
	const activeModel = models.find((model) => model.id === modelId);
	const meta = activeModel ? getModelMetadata(activeModel) : null;
	const modelDetails = meta
		? [
				meta.context ? t('provider.modelPicker.context', { value: meta.context }) : null,
				meta.inputPrice ? t('provider.modelPicker.inputPrice', { value: meta.inputPrice }) : null,
				meta.outputPrice ? t('provider.modelPicker.outputPrice', { value: meta.outputPrice }) : null,
			]
				.filter(Boolean)
				.join(' · ')
		: '';
	const providerOptions = useMemo(
		() => providers.filter((item) => item.enabled).map((item) => ({ value: item.id, label: item.name })),
		[providers],
	);
	const tokenOptions = useMemo(
		() => tokens.map((token) => ({ value: token.id, label: `${token.name} · ${token.tokenHint}` })),
		[tokens],
	);

	return (
		<Stack gap="md">
			<Text fw={650}>{t('provider.connection.title')}</Text>
			<Select
				label={t('provider.providerLabel')}
				data={providerOptions}
				value={providerId}
				onChange={(value) => value && void onProviderChange(value as LlmProviderId)}
				allowDeselect={false}
				comboboxProps={{ withinPortal: false }}
			/>

			{providerId === 'openai_compatible' ? (
				<TextInput
					label={t('provider.config.baseUrl')}
					value={String(config.baseUrl ?? '')}
					onChange={(event) => onConfigChange({ ...config, baseUrl: event.currentTarget.value })}
					placeholder="http://localhost:1234/v1"
				/>
			) : null}

			<Input.Wrapper label={t('provider.tokens.title')}>
				<Group wrap="nowrap" gap="xs">
					<Select
						data={tokenOptions}
						value={tokenId}
						onChange={(value) => void onTokenChange(value ?? null)}
						placeholder={tokens.length ? t('provider.placeholders.selectToken') : t('provider.placeholders.noTokens')}
						clearable
						searchable
						style={{ flex: 1 }}
						comboboxProps={{ withinPortal: false }}
					/>
					<Button
						variant="default"
						px="sm"
						onClick={() => setTokenManagerOpen(true)}
						aria-label={t('provider.tokens.manage')}
					>
						<LuKeyRound />
					</Button>
				</Group>
			</Input.Wrapper>

			{providerId === 'openai_compatible' ? (
				<Stack gap="xs">
					<TextInput
						label={t('provider.model.manual')}
						value={modelId ?? ''}
						onChange={(event) => void onModelChange(event.currentTarget.value)}
						placeholder={t('provider.model.manualCompatiblePlaceholder')}
					/>
					<Button
						variant="default"
						leftSection={<LuSearch />}
						disabled={!tokenId}
						onClick={() => setModelPickerOpen(true)}
					>
						{t('provider.model.browseCatalog')}
					</Button>
				</Stack>
			) : (
				<Input.Wrapper label={t('provider.model.title')}>
					<UnstyledButton
						onClick={() => setModelPickerOpen(true)}
						disabled={!tokenId}
						aria-label={t('provider.modelPicker.open')}
						style={{
							width: '100%',
							minHeight: 58,
							border: '1px solid var(--mantine-color-default-border)',
							borderRadius: 'var(--mantine-radius-md)',
							padding: '9px 12px',
							opacity: tokenId ? 1 : 0.55,
						}}
					>
						<Group justify="space-between" wrap="nowrap">
							<Stack gap={1} style={{ minWidth: 0 }}>
								<Text fw={600} c={modelId ? undefined : 'dimmed'} truncate>
									{activeModel?.name ?? modelId ?? t('provider.placeholders.selectModel')}
								</Text>
								{modelId ? (
									<Text size="xs" c="dimmed" truncate>
										{[modelId, modelDetails].filter(Boolean).join(' · ')}
									</Text>
								) : null}
							</Stack>
							<LuSearch />
						</Group>
					</UnstyledButton>
				</Input.Wrapper>
			)}

			<Group justify="flex-end">
				<Button variant="default" loading={isChecking} disabled={!tokenId} onClick={() => void onCheckConnection()}>
					{t('provider.config.checkConnection')}
				</Button>
			</Group>

			<LlmTokenManagerDialog
				open={tokenManagerOpen}
				onOpenChange={setTokenManagerOpen}
				providerId={providerId}
				providerName={activeProvider?.name ?? providerId}
				activeTokenId={tokenId}
				onTokenSelected={(value) => void onTokenChange(value)}
			/>
			<LlmModelPickerDialog
				open={modelPickerOpen}
				onOpenChange={setModelPickerOpen}
				models={models}
				selectedModel={modelId}
				isLoading={isLoadingModels}
				onRefresh={onRefreshModels}
				onSelect={(value) => void onModelChange(value)}
				showCapabilityFilters={providerId === 'openrouter'}
			/>
		</Stack>
	);
};
