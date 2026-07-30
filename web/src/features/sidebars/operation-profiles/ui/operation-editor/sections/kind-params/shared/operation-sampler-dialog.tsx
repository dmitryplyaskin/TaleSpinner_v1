import { Button, Select, Stack, Text } from '@mantine/core';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getLlmSettingsFields } from '@model/llm-settings';
import { Dialog } from '@ui/dialog';

import { SamplerSettingsGrid } from '../../../../../../../llm-provider/sampler-settings-grid';
import { pickNumericSamplers, type OperationSamplerFields } from '../../../../../form/operation-llm-form-utils';

import type { SamplersItemType } from '@shared/types/samplers';
import type { Control, FieldValues } from 'react-hook-form';

type Props<TFieldValues extends FieldValues> = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	control: Control<TFieldValues>;
	fieldPrefix: string;
	samplerFields: OperationSamplerFields;
	samplerPresets: SamplersItemType[];
	onSamplerFieldsChange: (patch: Partial<OperationSamplerFields>) => void;
};

export function OperationSamplerDialog<TFieldValues extends FieldValues>({
	open,
	onOpenChange,
	control,
	fieldPrefix,
	samplerFields,
	samplerPresets,
	onSamplerFieldsChange,
}: Props<TFieldValues>) {
	const { t } = useTranslation();
	const llmSettingsFields = getLlmSettingsFields(t);
	const options = useMemo(
		() =>
			samplerPresets
				.filter((item) => typeof item.id === 'string' && typeof item.name === 'string')
				.map((item) => ({ value: item.id, label: item.name })),
		[samplerPresets],
	);

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
			title={t('operationProfiles.samplers.dialogTitle')}
			size="xl"
			footer={
				<Button variant="subtle" onClick={() => onOpenChange(false)}>
					{t('common.close')}
				</Button>
			}
		>
			<Stack gap="md">
				<Text size="sm" c="dimmed">
					{t('operationProfiles.samplers.dialogDescription')}
				</Text>
				<Select
					label={t('operationProfiles.kindSection.llm.samplerPreset')}
					description={t('operationProfiles.kindSection.llm.samplerPresetInfo')}
					data={options}
					value={samplerFields.samplerPresetId || null}
					onChange={(nextValue) => {
						const presetId = nextValue ?? '';
						const preset = samplerPresets.find((item) => item.id === presetId);
						onSamplerFieldsChange({
							samplerPresetId: presetId,
							samplers: preset ? pickNumericSamplers(preset.settings) : samplerFields.samplers,
						});
					}}
					clearable
					searchable
					comboboxProps={{ withinPortal: false }}
				/>
				<SamplerSettingsGrid control={control} fields={llmSettingsFields} fieldPrefix={fieldPrefix} />
			</Stack>
		</Dialog>
	);
}
