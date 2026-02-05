import { Badge, Button, Card, Group, Select, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { LuTrash2 } from 'react-icons/lu';


import { FormInput } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { makeDefaultArtifactOutput, type FormOtherKindParams, type FormTemplateParams } from '../../form/operation-profile-form-mapping';

import { OperationSectionsAccordion } from './operation-sections-accordion';

import type { OperationKind } from '@shared/types/operation-profiles';

type Props = {
	index: number;
	title?: string;
	status?: {
		index: number;
		kind: OperationKind;
		isDirty: boolean;
	};
	canSave?: boolean;
	canDiscard?: boolean;
	onSave?: () => void;
	onDiscard?: () => void;
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

function isOperationKind(value: unknown): value is OperationKind {
	return (
		value === 'template' ||
		value === 'llm' ||
		value === 'rag' ||
		value === 'tool' ||
		value === 'compute' ||
		value === 'transform' ||
		value === 'legacy'
	);
}

function makeSafeOutput(output: unknown) {
	if (output && typeof output === 'object') return output;
	return makeDefaultArtifactOutput();
}

export const OperationEditor: React.FC<Props> = memo(({ index, title, status, canSave, canDiscard, onSave, onDiscard, onRemove }) => {
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
				<div className="op-editorHeader">
					<Group gap="xs" wrap="wrap">
						<Text fw={700}>{title ?? 'Operation'}</Text>
						{status && (
							<>
								<Badge variant="light">#{status.index}</Badge>
								<Badge variant="outline">{status.kind}</Badge>
								{status.isDirty && <Badge color="yellow">Unsaved</Badge>}
							</>
						)}
					</Group>

					<Group gap="xs" wrap="nowrap">
						{onSave && (
							<Button size="xs" onClick={onSave} disabled={!canSave}>
								Save
							</Button>
						)}
						{onDiscard && (
							<Button size="xs" variant="default" onClick={onDiscard} disabled={!canDiscard}>
								Discard
							</Button>
						)}
						{onRemove && (
							<IconButtonWithTooltip
								aria-label="Delete operation"
								tooltip="Delete operation"
								icon={<LuTrash2 />}
								colorPalette="red"
								variant="ghost"
								onClick={onRemove}
							/>
						)}
					</Group>
				</div>

				<Group justify="space-between" wrap="nowrap" align="flex-end">
					<FormInput name={`operations.${index}.name`} label="Operation name" inputProps={{ style: { flex: 1 } }} />
					<Select
						{...kindField}
						label="Kind"
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
								return;
							}

							const nextParams: FormOtherKindParams = {
								paramsJson: '{\n  \n}',
								output: safeOutput as FormOtherKindParams['output'],
							};
							setValue(`operations.${index}.config.params`, nextParams, { shouldDirty: true });
						}}
						comboboxProps={{ withinPortal: false }}
						description="Kind controls available params fields."
						style={{ width: 180 }}
					/>
				</Group>

				<Text size="xs" c="dimmed">
					opId: {safeOpId || '—'}
				</Text>

				<OperationSectionsAccordion index={index} kind={normalizedKind} />
			</Stack>
		</Card>
	);
});

OperationEditor.displayName = 'OperationEditor';
