import { Button, Stack, Text } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { Dialog } from '@ui/dialog';

import { LlmConnectionSelector } from '../../../../../../../llm-provider/llm-connection-editor';

import { OperationLlmPresetManager } from './operation-llm-preset-manager';

import type { LlmPresetDto } from '../../../../../../../../api/llm';
import type { OperationLlmRuntimeFields } from '../../../../../form/operation-llm-form-utils';
import type { LlmModel, LlmProviderDefinition, LlmProviderId, LlmTokenListItem } from '@shared/types/llm';

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	providers: LlmProviderDefinition[];
	tokens: LlmTokenListItem[];
	models: LlmModel[];
	isLoadingModels: boolean;
	presets: LlmPresetDto[];
	runtime: OperationLlmRuntimeFields;
	onRuntimeChange: (patch: Partial<OperationLlmRuntimeFields>) => void;
	onPresetSelect: (presetId: string | null) => void;
	onLoadModels: () => Promise<void>;
	onCreatePreset: (params: { name: string; payload: LlmPresetDto['payload'] }) => Promise<LlmPresetDto>;
	onUpdatePreset: (params: {
		presetId: string;
		name?: string;
		description?: string | null;
		payload?: LlmPresetDto['payload'];
	}) => Promise<LlmPresetDto>;
	onDeletePreset: (presetId: string) => Promise<{ id: string }>;
};

export const OperationLlmRuntimeDialog: React.FC<Props> = ({
	open,
	onOpenChange,
	providers,
	tokens,
	models,
	isLoadingModels,
	presets,
	runtime,
	onRuntimeChange,
	onPresetSelect,
	onLoadModels,
	onCreatePreset,
	onUpdatePreset,
	onDeletePreset,
}) => {
	const { t } = useTranslation();

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={t('operationProfiles.llmRuntime.dialogTitle')}
			size="xl"
			footer={
				<Button variant="subtle" onClick={() => onOpenChange(false)}>
					{t('common.close')}
				</Button>
			}
		>
			<Stack gap="md">
				<Text size="sm" c="dimmed">
					{t('operationProfiles.llmRuntime.dialogDescription')}
				</Text>

				<OperationLlmPresetManager
					presets={presets}
					selectedPresetId={runtime.llmPresetId}
					runtime={runtime}
					onPresetSelect={onPresetSelect}
					onCreatePreset={onCreatePreset}
					onUpdatePreset={onUpdatePreset}
					onDeletePreset={onDeletePreset}
				/>

				<LlmConnectionSelector
					providers={providers}
					providerId={runtime.providerId}
					tokens={tokens}
					tokenId={runtime.credentialRef || null}
					models={models}
					modelId={runtime.model || null}
					isLoadingModels={isLoadingModels}
					onProviderChange={async (providerId: LlmProviderId) =>
						onRuntimeChange({
							providerId,
							credentialRef: '',
							model: '',
						})
					}
					onTokenChange={async (tokenId: string | null) =>
						onRuntimeChange({
							credentialRef: tokenId ?? '',
							model: '',
						})
					}
					onModelChange={async (model: string) => onRuntimeChange({ model })}
					onRefreshModels={onLoadModels}
					showProviderConfig={false}
					showConnectionCheck={false}
				/>
				<Text size="sm" c="dimmed">
					{t('operationProfiles.llmRuntime.tokenHelp')}
				</Text>
			</Stack>
		</Dialog>
	);
};
