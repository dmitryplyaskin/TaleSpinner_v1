import { Button, Group, Input, Select, Stack, Text, TextInput } from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TokenManager } from './token-manager';

import type { LlmModel, LlmProviderDefinition, LlmProviderId, LlmScope, LlmTokenListItem } from '@shared/types/llm';

type SelectOption = { value: string; label: string };

type Props = {
	scope: LlmScope;
	scopeId: string;
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
	onOpenTokenManager: (open: boolean) => void;
};

export const LlmRuntimeSelector: React.FC<Props> = ({
	scope,
	scopeId,
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
				.map((provider) => ({
					value: provider.id,
					label: provider.name,
				})),
		[providers],
	);

	const tokenOptions: SelectOption[] = useMemo(
		() =>
			tokens.map((token) => ({
				value: token.id,
				label: token.tokenHint ? `${token.name} (${token.tokenHint})` : token.name,
			})),
		[tokens],
	);

	const modelOptions: SelectOption[] = useMemo(
		() =>
			models.map((model) => ({
				value: model.id,
				label: model.name ?? model.id,
			})),
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
					<Button size="xs" variant="outline" onClick={() => onOpenTokenManager(true)}>
						{t('provider.tokens.manage')}
					</Button>
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
				<TokenManager providerId={activeProviderId} scope={scope} scopeId={scopeId} />
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
