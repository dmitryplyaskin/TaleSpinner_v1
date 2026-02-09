import { Badge, Button, Card, Group, Select, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { LuTrash2 } from 'react-icons/lu';

import { FormInput } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { TOOLTIP_PORTAL_SETTINGS } from '@ui/z-index';

import { makeDefaultArtifactOutput, type FormOtherKindParams, type FormTemplateParams } from '../../form/operation-profile-form-mapping';

import { OperationSectionsAccordion } from './operation-sections-accordion';

import type { OperationKind } from '@shared/types/operation-profiles';

const ACTION_TOOLTIP_SETTINGS = TOOLTIP_PORTAL_SETTINGS;

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
	const { t } = useTranslation();
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
		<Card withBorder className="op-operationCard">
			<Stack gap="md">
				<div className="op-editorHeader op-operationHeader">
					<Group gap="xs" wrap="wrap">
						<Text fw={700}>{title ?? t('operationProfiles.operationEditor.title')}</Text>
						{status && (
							<>
								<Badge variant="light">#{status.index}</Badge>
								<Badge variant="outline">{status.kind}</Badge>
								{status.isDirty && <Badge color="yellow">{t('operationProfiles.operationEditor.unsaved')}</Badge>}
							</>
						)}
					</Group>

					<Group gap="xs" wrap="nowrap" className="op-operationActions">
						{onSave && (
							<Button size="sm" onClick={onSave} disabled={!canSave}>
								{t('common.save')}
							</Button>
						)}
						{onDiscard && (
							<Button size="sm" variant="default" onClick={onDiscard} disabled={!canDiscard}>
								{t('operationProfiles.actions.discard')}
							</Button>
						)}
						{onRemove && (
							<IconButtonWithTooltip
								aria-label={t('operationProfiles.actions.deleteOperation')}
								tooltip={t('operationProfiles.actions.deleteOperation')}
								icon={<LuTrash2 />}
								colorPalette="red"
								size="input-sm"
								variant="ghost"
								tooltipSettings={ACTION_TOOLTIP_SETTINGS}
								onClick={onRemove}
							/>
						)}
					</Group>
				</div>

				<Group justify="space-between" wrap="wrap" align="flex-end" className="op-operationIdentityRow">
					<FormInput name={`operations.${index}.name`} label={t('operationProfiles.fields.operationName')} inputProps={{ style: { flex: 1 } }} />
					<Select
						{...kindField}
						label={t('operationProfiles.fields.kind')}
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
						description={t('operationProfiles.fields.kindDescription')}
						style={{ width: 210 }}
					/>
				</Group>

				<Text size="xs" c="dimmed" className="op-opIdText">
					{t('operationProfiles.fields.opId', { value: safeOpId || '—' })}
				</Text>

				<OperationSectionsAccordion index={index} kind={normalizedKind} />
			</Stack>
		</Card>
	);
});

OperationEditor.displayName = 'OperationEditor';
