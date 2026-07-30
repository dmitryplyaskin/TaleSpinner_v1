import { Select, Stack, Switch, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import type { RagProviderConfig, RagProviderId } from '@shared/types/rag';

type Props = {
	providerId: RagProviderId;
	config: RagProviderConfig;
	onChange: (config: RagProviderConfig) => void;
};

export const RagProviderAdvancedConfig: React.FC<Props> = ({ providerId, config, onChange }) => {
	const { t } = useTranslation();
	const update = (patch: RagProviderConfig) => onChange({ ...config, ...patch });

	return (
		<Stack gap="md">
			<TextInput
				label={t('rag.config.fields.defaultModel')}
				value={String(config.defaultModel ?? '')}
				onChange={(event) => update({ defaultModel: event.currentTarget.value || undefined })}
				placeholder={providerId === 'openrouter' ? 'openai/text-embedding-3-small' : 'nomic-embed-text'}
			/>
			{providerId === 'openrouter' ? (
				<>
					<TextInput
						label={t('rag.config.fields.dimensions')}
						type="number"
						min={1}
						value={config.dimensions === undefined ? '' : String(config.dimensions)}
						onChange={(event) => {
							const value = Number.parseInt(event.currentTarget.value, 10);
							update({ dimensions: Number.isInteger(value) && value > 0 ? value : undefined });
						}}
					/>
					<Select
						label={t('rag.config.fields.encodingFormat')}
						data={['float', 'base64']}
						value={config.encodingFormat ?? 'float'}
						onChange={(value) => update({ encodingFormat: value === 'base64' ? 'base64' : 'float' })}
						allowDeselect={false}
						comboboxProps={{ withinPortal: false }}
					/>
					<TextInput
						label={t('rag.config.fields.user')}
						value={String(config.user ?? '')}
						onChange={(event) => update({ user: event.currentTarget.value || undefined })}
					/>
				</>
			) : (
				<>
					<TextInput
						label={t('rag.config.fields.keepAlive')}
						value={String(config.keepAlive ?? '')}
						onChange={(event) => update({ keepAlive: event.currentTarget.value || undefined })}
						placeholder="5m"
					/>
					<Switch
						label={t('rag.config.fields.truncate')}
						checked={config.truncate !== false}
						onChange={(event) => update({ truncate: event.currentTarget.checked })}
					/>
				</>
			)}
		</Stack>
	);
};
