import { Button, Group, Input, Select, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TokenManager } from './token-manager';

import type { LlmModel, LlmProviderDefinition, LlmProviderId, LlmScope, LlmTokenListItem } from '@shared/types/llm';

type SelectOption = { value: string; label: string };

function toSafeOption(value: unknown, label: unknown): SelectOption | null {
	if (typeof value !== 'string' || value.length === 0) return null;
	return {
		value,
		label: typeof label === 'string' && label.length > 0 ? label : value,
	};
}

type Props = {
	providers: LlmProviderDefinition[];
	activeProviderId: LlmProviderId;
	tokens: LlmTokenListItem[];
	activeTokenId: string | null;
	models: LlmModel[];
	activeModel: string | null;
	onProviderSelect: (providerId: LlmProviderId) => void;
	onTokenSelect: (tokenId: string | null) => void;
	onModelSelect: (model: string | null) => void;
	onLoadModels: () => Promise<void>;
	allowTokenManager?: boolean;
	tokenManagerScope?: LlmScope;
	tokenManagerScopeId?: string;
	onOpenTokenManager?: (open: boolean) => void;
};

export const LlmRuntimeSelectorFields: React.FC<Props> = ({
	providers,
	activeProviderId,
	tokens,
	activeTokenId,
	models,
	activeModel,
	onProviderSelect,
	onTokenSelect,
	onModelSelect,
	onLoadModels,
	allowTokenManager = false,
	tokenManagerScope,
	tokenManagerScopeId,
	onOpenTokenManager,
}) => {
	const { t } = useTranslation();
	const [manualModel, setManualModel] = useState('');

	useEffect(() => {
		setManualModel(activeModel ?? '');
	}, [activeModel]);

	const providerOptions: SelectOption[] = useMemo(
		() =>
			providers
				.filter((provider) => provider.enabled)
				.map((provider) => toSafeOption(provider.id, provider.name))
				.filter((item): item is SelectOption => item !== null),
		[providers],
	);

	const tokenOptions: SelectOption[] = useMemo(
		() =>
			tokens
				.map((token) => toSafeOption(token.id, token.tokenHint ? `${token.name} (${token.tokenHint})` : token.name))
				.filter((item): item is SelectOption => item !== null),
		[tokens],
	);

	const modelOptions: SelectOption[] = useMemo(
		() =>
			models
				.map((model) => toSafeOption(model.id, model.name ?? model.id))
				.filter((item): item is SelectOption => item !== null),
		[models],
	);

	const selectedModelOption = modelOptions.find((item) => item.value === activeModel) ?? null;
	const canLoadModels = Boolean(activeTokenId);

	const applyManualModel = () => {
		const next = manualModel.trim();
		onModelSelect(next.length > 0 ? next : null);
	};

	return (
		<Stack gap="lg">
			<Input.Wrapper label={t('provider.providerLabel')}>
				<Select
					data={providerOptions}
					value={activeProviderId}
					onChange={(value) => {
						onProviderSelect((value ?? 'openrouter') as LlmProviderId);
					}}
					placeholder={t('provider.placeholders.selectProvider')}
					searchable
					allowDeselect={false}
					comboboxProps={{ withinPortal: false }}
				/>
			</Input.Wrapper>

			<Stack gap="xs">
				<Group justify="space-between">
					<Text fw={600}>{t('provider.tokens.title')}</Text>
					{allowTokenManager && onOpenTokenManager && tokenManagerScope && tokenManagerScopeId ? (
						<Button size="xs" variant="outline" onClick={() => onOpenTokenManager(true)}>
							{t('provider.tokens.manage')}
						</Button>
					) : null}
				</Group>

				<Select
					data={tokenOptions}
					value={activeTokenId}
					onChange={(value) => onTokenSelect(value ?? null)}
					placeholder={tokens.length ? t('provider.placeholders.selectToken') : t('provider.placeholders.noTokens')}
					clearable
					searchable
					comboboxProps={{ withinPortal: false }}
				/>
				{allowTokenManager && tokenManagerScope && tokenManagerScopeId ? (
					<TokenManager providerId={activeProviderId} scope={tokenManagerScope} scopeId={tokenManagerScopeId} />
				) : null}
			</Stack>

			<Stack gap="xs">
				<Group justify="space-between">
					<Text fw={600}>{t('provider.model.title')}</Text>
					<Button size="xs" variant="outline" onClick={() => void onLoadModels()} disabled={!canLoadModels}>
						{t('provider.model.load')}
					</Button>
				</Group>

				<Select
					data={modelOptions}
					value={selectedModelOption?.value ?? null}
					onChange={(value) => {
						onModelSelect(value ?? null);
						setManualModel(value ?? '');
					}}
					clearable
					searchable
					placeholder={canLoadModels ? t('provider.placeholders.selectModel') : t('provider.placeholders.selectTokenFirst')}
					disabled={!canLoadModels}
					comboboxProps={{ withinPortal: false }}
				/>

				<Group align="flex-end" wrap="nowrap">
					<TextInput
						label={t('provider.model.manual')}
						value={manualModel}
						onChange={(event) => setManualModel(event.currentTarget.value)}
						onBlur={applyManualModel}
						placeholder={t('provider.model.manualPlaceholder')}
						disabled={!canLoadModels}
						style={{ flex: 1 }}
					/>
					<Button size="xs" variant="light" onClick={applyManualModel} disabled={!canLoadModels}>
						{t('provider.model.applyManual')}
					</Button>
				</Group>

				<Text size="sm" c="dimmed">
					{t('provider.model.helpText')}
				</Text>
			</Stack>
		</Stack>
	);
};
