import { Button, Group, Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import type { LlmProviderConfig, LlmProviderId } from '@shared/types/llm';

type Props = {
	activeProviderId: LlmProviderId;
	configDraft: LlmProviderConfig;
	onChange: (next: LlmProviderConfig) => void;
	onSave: () => Promise<void>;
};

const TTL_OPTIONS = [
	{ value: '5m', label: '5m' },
	{ value: '1h', label: '1h' },
];

export const LlmProviderAdvancedConfig: React.FC<Props> = ({ activeProviderId, configDraft, onChange, onSave }) => {
	const { t } = useTranslation();

	const tokenPolicy = configDraft.tokenPolicy ?? {};
	const anthropicCache = configDraft.anthropicCache ?? {};

	const updateTokenPolicy = (patch: Partial<NonNullable<LlmProviderConfig['tokenPolicy']>>) => {
		onChange({
			...configDraft,
			tokenPolicy: {
				...tokenPolicy,
				...patch,
			},
		});
	};

	const updateAnthropicCache = (patch: Partial<NonNullable<LlmProviderConfig['anthropicCache']>>) => {
		onChange({
			...configDraft,
			anthropicCache: {
				...anthropicCache,
				...patch,
			},
		});
	};

	return (
		<Stack gap="sm">
			<Text fw={600}>{t('provider.config.title')}</Text>

			{activeProviderId === 'openai_compatible' && (
				<TextInput
					label={t('provider.config.baseUrl')}
					value={String(configDraft.baseUrl ?? '')}
					onChange={(event) => onChange({ ...configDraft, baseUrl: event.currentTarget.value })}
					placeholder="http://localhost:1234/v1"
				/>
			)}

			<TextInput
				label={t('provider.config.defaultModel')}
				value={String(configDraft.defaultModel ?? '')}
				onChange={(event) => onChange({ ...configDraft, defaultModel: event.currentTarget.value })}
				placeholder="gpt-4o-mini"
			/>

			<Stack gap={6}>
				<Text size="sm" fw={600}>
					{t('provider.config.tokenPolicy.title')}
				</Text>
				<Switch
					checked={tokenPolicy.randomize === true}
					onChange={(event) => updateTokenPolicy({ randomize: event.currentTarget.checked })}
					label={t('provider.config.tokenPolicy.randomize')}
				/>
				<Switch
					checked={tokenPolicy.fallbackOnError === true}
					onChange={(event) => updateTokenPolicy({ fallbackOnError: event.currentTarget.checked })}
					label={t('provider.config.tokenPolicy.fallbackOnError')}
				/>
			</Stack>

			<Stack gap={6}>
				<Text size="sm" fw={600}>
					{t('provider.config.anthropicCache.title')}
				</Text>
				<Switch
					checked={anthropicCache.enabled === true}
					onChange={(event) => updateAnthropicCache({ enabled: event.currentTarget.checked })}
					label={t('provider.config.anthropicCache.enabled')}
				/>

				{anthropicCache.enabled === true && (
					<>
						<TextInput
							label={t('provider.config.anthropicCache.depth')}
							value={String(anthropicCache.depth ?? 0)}
							onChange={(event) => {
								const value = Number.parseInt(event.currentTarget.value, 10);
								updateAnthropicCache({ depth: Number.isFinite(value) && value >= 0 ? value : 0 });
							}}
						/>
						<Select
							label={t('provider.config.anthropicCache.ttl')}
							data={TTL_OPTIONS}
							value={anthropicCache.ttl ?? '5m'}
							onChange={(value) =>
								updateAnthropicCache({
									ttl: value === '1h' ? '1h' : '5m',
								})
							}
							allowDeselect={false}
							comboboxProps={{ withinPortal: false }}
						/>
						<Text size="xs" c="dimmed">
							{t('provider.config.anthropicCache.helpText')}
						</Text>
					</>
				)}
			</Stack>

			<Group justify="flex-end">
				<Button size="xs" variant="outline" onClick={() => void onSave()}>
					{t('provider.config.save')}
				</Button>
			</Group>
		</Stack>
	);
};
