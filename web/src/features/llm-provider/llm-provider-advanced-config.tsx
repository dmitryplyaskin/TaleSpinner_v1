import { Select, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import type { LlmProviderConfig } from '@shared/types/llm';

type Props = {
	configDraft: LlmProviderConfig;
	onChange: (next: LlmProviderConfig) => void;
};

const TTL_OPTIONS = [
	{ value: '5m', label: '5m' },
	{ value: '1h', label: '1h' },
];

export const LlmProviderAdvancedConfig: React.FC<Props> = ({ configDraft, onChange }) => {
	const { t } = useTranslation();

	const tokenPolicy = configDraft.tokenPolicy ?? {};
	const anthropicCache = configDraft.anthropicCache ?? {};
	const messageNormalization = configDraft.messageNormalization ?? {};

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

	const updateMessageNormalization = (patch: Partial<NonNullable<LlmProviderConfig['messageNormalization']>>) => {
		onChange({
			...configDraft,
			messageNormalization: {
				...messageNormalization,
				...patch,
			},
		});
	};

	return (
		<Stack gap="md">
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
					{t('provider.config.messageNormalization.title')}
				</Text>
				<Switch
					checked={messageNormalization.enabled !== false}
					onChange={(event) => updateMessageNormalization({ enabled: event.currentTarget.checked })}
					label={t('provider.config.messageNormalization.enabled')}
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
					</>
				)}
			</Stack>
		</Stack>
	);
};
