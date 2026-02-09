import { ActionIcon, Flex, NumberInput, Paper, Select, SimpleGrid, Slider, Text, Tooltip } from '@mantine/core';
import { type SamplerItemSettingsType, type SamplersItemType } from '@shared/types/samplers';
import { useUnit } from 'effector-react';
import React, { useEffect } from 'react';
import { FormProvider, useController, useForm, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuInfo, LuPlus, LuSave, LuTrash2 } from 'react-icons/lu';

import { createEmptySampler, samplersModel } from '@model/samplers';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { getLlmSettingsFields, type LLMSettingField } from '../../../model/llm-settings';




export interface LLMSettings {
	temperature: number;
	maxTokens: number;
	topP: number;
	frequencyPenalty: number;
	presencePenalty: number;
}

export const SamplerSettingsTab: React.FC = () => {
	const { t } = useTranslation();
	const settings = useUnit(samplersModel.$settings);
	const items = useUnit(samplersModel.$items);
	const llmSettingsFields = getLlmSettingsFields(t);

	const methods = useForm<SamplerItemSettingsType>({
		defaultValues: items.find((instr) => instr.id === settings.selectedId)?.settings,
	});

	useEffect(() => {
		methods.reset(items.find((instr) => instr.id === settings.selectedId)?.settings);
	}, [settings.selectedId]);

	const handleSave = () => {
		const item = items.find((instr) => instr.id === settings.selectedId) as SamplersItemType;
		const newItem = { ...item, settings: methods.getValues() } as SamplersItemType;

		samplersModel.updateItemFx(newItem);
	};

	useEffect(() => {
		const { unsubscribe } = methods.watch((data) => {
			const item = items.find((instr) => instr.id === settings.selectedId) as SamplersItemType;
			const newItem = { ...item, settings: data } as SamplersItemType;

			samplersModel.changeItemDebounced(newItem);
		});
		return () => {
			unsubscribe();
		};
	}, [methods.watch]);

	const options = items
		.map((item) => ({
			label: String((item as unknown as { name?: unknown })?.name ?? ''),
			value: typeof (item as unknown as { id?: unknown })?.id === 'string' ? (item as unknown as { id: string }).id : '',
		}))
		.filter((o) => Boolean(o.value));

	return (
		<Flex direction="column" gap="md">
			<Flex gap="md" align="flex-end">
				<Select
					data={options}
					value={settings?.selectedId ?? null}
					onChange={(selectedId) => samplersModel.updateSettingsFx({ ...settings, selectedId: selectedId ?? null })}
					placeholder={t('llmSettings.selectSampler')}
					comboboxProps={{ withinPortal: false }}
					style={{ flex: 1 }}
				/>
				<Flex gap="xs">
					<IconButtonWithTooltip
						tooltip={t('llmSettings.actions.save')}
						icon={<LuSave />}
						aria-label={t('llmSettings.actions.save')}
						onClick={handleSave}
					/>
					<IconButtonWithTooltip
						tooltip={t('llmSettings.actions.create')}
						icon={<LuPlus />}
						aria-label={t('llmSettings.actions.create')}
						onClick={() => samplersModel.createItemFx(createEmptySampler(methods.getValues()))}
					/>
					<IconButtonWithTooltip
						tooltip={t('llmSettings.actions.duplicate')}
						icon={<LuCopy />}
						aria-label={t('llmSettings.actions.duplicate')}
						disabled={!settings.selectedId}
						onClick={() =>
							samplersModel.duplicateItemFx(items.find((instr) => instr.id === settings.selectedId) as SamplersItemType)
						}
					/>

					<IconButtonWithTooltip
						tooltip={t('llmSettings.actions.delete')}
						icon={<LuTrash2 />}
						aria-label={t('llmSettings.actions.delete')}
						disabled={!settings.selectedId}
						onClick={() => samplersModel.deleteItemFx(settings.selectedId as string)}
					/>
				</Flex>
			</Flex>

			<FormProvider {...methods}>
				<SimpleGrid cols={3} spacing="md">
					{llmSettingsFields.map((field) => (
						<Item key={field.key} field={field} methods={methods} />
					))}
				</SimpleGrid>
			</FormProvider>
		</Flex>
	);
};

type ItemProps = {
	field: LLMSettingField;
	methods: UseFormReturn<SamplerItemSettingsType>;
};

const Item: React.FC<ItemProps> = ({ field, methods }) => {
	const { t } = useTranslation();
	const formField = useController({
		name: field.key,
		control: methods.control,
	});

	return (
		<Paper key={field.key} withBorder radius="md" p="md" style={{ gridColumn: `span ${field.width}` }}>
			<Flex align="flex-start" justify="space-between" mb="xs">
				<Flex align="center" gap="xs" style={{ flex: 1, minWidth: 0 }}>
					<Text size="sm" fw={500}>
						{field.label}
					</Text>
					<Tooltip label={field.tooltip} position="bottom" withArrow>
						<ActionIcon variant="subtle" aria-label={t('common.info')}>
							<LuInfo />
						</ActionIcon>
					</Tooltip>
				</Flex>
			</Flex>

			<Slider
				min={field.min}
				max={field.max}
				step={field.step}
				value={Number(formField.field.value ?? 0)}
				onChange={(value) => {
					formField.field.onChange(value);
				}}
			/>
			<NumberInput
				mt="xs"
				min={field.min}
				max={field.max}
				step={field.step}
				value={Number(formField.field.value ?? 0)}
				onChange={(value) => {
					formField.field.onChange(typeof value === 'number' ? value : 0);
				}}
				onBlur={() => {
					formField.field.onBlur();
				}}
			/>
		</Paper>
	);
};
