import { ActionIcon, Flex, NumberInput, Paper, SimpleGrid, Slider, Tooltip } from '@mantine/core';
import React from 'react';
import { useController, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuInfo } from 'react-icons/lu';

import type { LLMSettingField } from '@model/llm-settings';

type Props = {
	control: Control<any>;
	fields: LLMSettingField[];
	fieldPrefix?: string;
	columns?: number;
};

function buildFieldName(prefix: string | undefined, key: string): string {
	return prefix && prefix.length > 0 ? `${prefix}.${key}` : key;
}

function toNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export const SamplerSettingsGrid: React.FC<Props> = ({ control, fields, fieldPrefix, columns = 3 }) => {
	return (
		<SimpleGrid cols={columns} spacing="md">
			{fields.map((field) => (
				<SamplerSettingsGridItem
					key={field.key}
					control={control}
					field={field}
					name={buildFieldName(fieldPrefix, field.key)}
				/>
			))}
		</SimpleGrid>
	);
};

type ItemProps = {
	control: Control<any>;
	field: LLMSettingField;
	name: string;
};

const SamplerSettingsGridItem: React.FC<ItemProps> = ({ control, field, name }) => {
	const { t } = useTranslation();
	const formField = useController({
		name,
		control,
	});
	const fallback = typeof field.defaultValue === 'number' ? field.defaultValue : 0;
	const value = toNumber(formField.field.value, fallback);

	return (
		<Paper withBorder radius="md" p="md" style={{ gridColumn: `span ${field.width}` }}>
			<Flex align="flex-start" justify="space-between" mb="xs">
				<Flex align="center" gap="xs" style={{ flex: 1, minWidth: 0 }}>
					<span style={{ fontSize: 14, fontWeight: 500 }}>{field.label}</span>
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
				value={value}
				onChange={(nextValue) => {
					formField.field.onChange(nextValue);
				}}
			/>
			<NumberInput
				mt="xs"
				min={field.min}
				max={field.max}
				step={field.step}
				value={value}
				onChange={(nextValue) => {
					formField.field.onChange(typeof nextValue === 'number' ? nextValue : fallback);
				}}
				onBlur={() => {
					formField.field.onBlur();
				}}
			/>
		</Paper>
	);
};
