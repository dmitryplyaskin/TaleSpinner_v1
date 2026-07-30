import { Button, Group, Input, Select, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuKeyRound, LuSearch } from 'react-icons/lu';

import { LlmModelPickerDialog } from '../../llm-provider/llm-model-picker-dialog';
import { LlmTokenManagerDialog } from '../../llm-provider/llm-token-manager-dialog';

import type { LlmTokenListItem } from '@shared/types/llm';
import type { RagModel, RagProviderConfig, RagProviderDefinition, RagProviderId } from '@shared/types/rag';

type Props = {
	providers: RagProviderDefinition[];
	providerId: RagProviderId;
	tokens: LlmTokenListItem[];
	tokenId: string | null;
	models: RagModel[];
	modelId: string | null;
	config: RagProviderConfig;
	isLoadingModels: boolean;
	isChecking: boolean;
	onProviderChange: (providerId: RagProviderId) => Promise<void>;
	onTokenChange: (tokenId: string | null) => Promise<void>;
	onModelChange: (modelId: string | null) => Promise<void>;
	onConfigChange: (config: RagProviderConfig) => void;
	onRefreshModels: () => Promise<void>;
	onRefreshTokens: () => Promise<void>;
	onCheckConnection: () => Promise<void>;
};

export const RagConnectionEditor: React.FC<Props> = ({
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
	onRefreshTokens,
	onCheckConnection,
}) => {
	const { t } = useTranslation();
	const [tokenManagerOpen, setTokenManagerOpen] = useState(false);
	const [modelPickerOpen, setModelPickerOpen] = useState(false);
	const activeProvider = providers.find((provider) => provider.id === providerId);
	const activeModel = models.find((model) => model.id === modelId);
	const providerOptions = useMemo(
		() => providers.filter((provider) => provider.enabled).map((provider) => ({ value: provider.id, label: provider.name })),
		[providers],
	);
	const tokenOptions = useMemo(
		() => tokens.map((token) => ({ value: token.id, label: `${token.name} · ${token.tokenHint}` })),
		[tokens],
	);

	return (
		<Stack gap="md">
			<Text fw={650}>{t('rag.connection.title')}</Text>
			<Select
				label={t('rag.providerLabel')}
				data={providerOptions}
				value={providerId}
				onChange={(value) => value && void onProviderChange(value as RagProviderId)}
				allowDeselect={false}
				comboboxProps={{ withinPortal: false }}
			/>

			{providerId === 'ollama' ? (
				<TextInput
					label={t('rag.config.fields.baseUrl')}
					value={String(config.baseUrl ?? '')}
					onChange={(event) => onConfigChange({ ...config, baseUrl: event.currentTarget.value })}
					placeholder="http://localhost:11434"
				/>
			) : (
				<Input.Wrapper label={t('rag.tokens.title')}>
					<Group wrap="nowrap" gap="xs">
						<Select
							data={tokenOptions}
							value={tokenId}
							onChange={(value) => void onTokenChange(value ?? null)}
							placeholder={tokens.length ? t('rag.placeholders.selectToken') : t('rag.placeholders.noTokens')}
							clearable
							searchable
							style={{ flex: 1 }}
							comboboxProps={{ withinPortal: false }}
						/>
						<Button
							variant="default"
							px="sm"
							onClick={() => setTokenManagerOpen(true)}
							aria-label={t('rag.tokens.manage')}
						>
							<LuKeyRound />
						</Button>
					</Group>
				</Input.Wrapper>
			)}

			{providerId === 'openrouter' ? (
				<Input.Wrapper label={t('rag.model.title')}>
					<UnstyledButton
						onClick={() => setModelPickerOpen(true)}
						disabled={!tokenId}
						aria-label={t('rag.model.openPicker')}
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
									{activeModel?.name ?? modelId ?? t('rag.placeholders.selectModel')}
								</Text>
								{modelId ? <Text size="xs" c="dimmed" truncate>{modelId}</Text> : null}
							</Stack>
							<LuSearch />
						</Group>
					</UnstyledButton>
				</Input.Wrapper>
			) : (
				<TextInput
					label={t('rag.model.title')}
					value={modelId ?? ''}
					onChange={(event) => void onModelChange(event.currentTarget.value || null)}
					placeholder="nomic-embed-text"
				/>
			)}

			<Group justify="flex-end">
				<Button
					variant="default"
					loading={isChecking}
					disabled={providerId === 'openrouter' && !tokenId}
					onClick={() => void onCheckConnection()}
				>
					{t('rag.connection.check')}
				</Button>
			</Group>

			{providerId === 'openrouter' ? (
				<>
					<LlmTokenManagerDialog
						open={tokenManagerOpen}
						onOpenChange={setTokenManagerOpen}
						providerId="openrouter"
						providerName={activeProvider?.name ?? 'OpenRouter'}
						activeTokenId={tokenId}
						tokenItems={tokens}
						onTokenSelected={(value) => void onTokenChange(value)}
						onTokensChanged={onRefreshTokens}
					/>
					<LlmModelPickerDialog
						open={modelPickerOpen}
						onOpenChange={setModelPickerOpen}
						models={models}
						selectedModel={modelId}
						isLoading={isLoadingModels}
						onRefresh={onRefreshModels}
						onSelect={(value) => void onModelChange(value)}
						showCapabilityFilters={false}
					/>
				</>
			) : null}
		</Stack>
	);
};
