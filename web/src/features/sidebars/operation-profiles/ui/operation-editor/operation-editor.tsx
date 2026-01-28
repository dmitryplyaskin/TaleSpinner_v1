import { Card, Divider, Group, Select, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { LuTrash2 } from 'react-icons/lu';

import type { OperationKind } from '@shared/types/operation-profiles';

import { FormInput } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { makeDefaultArtifactOutput, type FormOtherKindParams, type FormTemplateParams } from '../../form/operation-profile-form-mapping';
import { BasicsSection } from './sections/basics-section';
import { ExecutionSection } from './sections/execution-section';
import { OutputSection } from './sections/output-section';
import { ParamsSection } from './sections/params-section';

type Props = {
	index: number;
	onRemove?: () => void;
};

const kindOptions = [
	{ value: 'template', label: 'template' },
	{ value: 'llm', label: 'llm' },
	{ value: 'rag', label: 'rag' },
	{ value: 'tool', label: 'tool' },
	{ value: 'compute', label: 'compute' },
	{ value: 'transform', label: 'transform' },
	{ value: 'legacy', label: 'legacy' },
];

function isOperationKind(v: unknown): v is OperationKind {
	return (
		v === 'template' ||
		v === 'llm' ||
		v === 'rag' ||
		v === 'tool' ||
		v === 'compute' ||
		v === 'transform' ||
		v === 'legacy'
	);
}

function makeSafeOutput(output: unknown) {
	if (output && typeof output === 'object') return output;
	return makeDefaultArtifactOutput();
}

export const OperationEditor: React.FC<Props> = memo(({ index, onRemove }) => {
	const opId = useWatch({ name: `operations.${index}.opId` }) as unknown;
	const output = useWatch({ name: `operations.${index}.config.params.output` }) as unknown;
	const { setValue, control } = useFormContext();

	const {
		field: { value: kindValue, onChange: onKindChange, ...kindField },
	} = useController({
		control,
		name: `operations.${index}.kind`,
	});

	const normalizedKind: OperationKind = isOperationKind(kindValue) ? kindValue : 'template';
	const safeOpId = typeof opId === 'string' ? opId : '';

	return (
		<Card withBorder>
			<Stack gap="md">
				<Group justify="space-between" wrap="nowrap" align="flex-end">
					<FormInput name={`operations.${index}.name`} label="Operation name" inputProps={{ style: { flex: 1 } }} />
					<Select
						{...kindField}
						label="kind"
						data={kindOptions}
						value={normalizedKind}
						onChange={(next) => {
							const nextKind: OperationKind = isOperationKind(next) ? next : 'template';
							onKindChange(nextKind);

							const safeOutput = makeSafeOutput(output);

							if (nextKind === 'template') {
								const nextParams: FormTemplateParams = {
									template: '',
									strictVariables: false,
									output: safeOutput as FormTemplateParams['output'],
								};
								setValue(`operations.${index}.config.params`, nextParams, { shouldDirty: true });
							} else {
								const nextParams: FormOtherKindParams = {
									paramsJson: '{\n  \n}',
									output: safeOutput as FormOtherKindParams['output'],
								};
								setValue(`operations.${index}.config.params`, nextParams, { shouldDirty: true });
							}
						}}
						comboboxProps={{ withinPortal: false }}
						description="Kind controls which params fields are available."
						style={{ width: 180 }}
					/>

					{onRemove && (
						<IconButtonWithTooltip
							aria-label="Delete operation"
							tooltip="Delete"
							icon={<LuTrash2 />}
							colorPalette="red"
							variant="ghost"
							onClick={onRemove}
						/>
					)}
				</Group>

				<Text size="xs" c="dimmed">
					opId: {safeOpId || '—'}
				</Text>

				<BasicsSection index={index} />

				<Divider />

				<ExecutionSection index={index} />

				<Divider />

				<ParamsSection index={index} kind={normalizedKind === 'template' ? 'template' : 'other'} />

				<Divider />

				<OutputSection index={index} />
			</Stack>
		</Card>
	);
});

OperationEditor.displayName = 'OperationEditor';

