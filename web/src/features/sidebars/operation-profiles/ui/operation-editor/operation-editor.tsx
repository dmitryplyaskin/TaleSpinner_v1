import { Badge, Button, Group, Select, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';


import { FormInput } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { TrashIcon } from '@ui/icons';
import { TOOLTIP_PORTAL_SETTINGS } from '@ui/z-index';

import { makeDefaultGuardKindParams, type FormGuardKindParams } from '../../form/guard-kind-form';
import {
	isKnowledgeOperationKind,
	makeDefaultKnowledgeKindParams,
	requiresJsonArtifactFormat,
	type FormKnowledgeKindParams,
} from '../../form/knowledge-kind-form';
import {
	makeDefaultArtifactOutput,
	makeDefaultLlmKindParams,
	makeDefaultOtherKindParams,
	type FormLlmKindParams,
	type FormOtherKindParams,
	type FormTemplateParams,
} from '../../form/operation-profile-form-mapping';
import { OPERATION_KIND_OPTIONS, isOperationKind } from '../../utils/operation-kind';

import { OperationSectionsAccordion } from './operation-sections-accordion';

import type { OperationArtifactConfig, OperationKind } from '@shared/types/operation-profiles';

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

function resolveArtifactForKind(opId: string, kind: OperationKind, currentValue: unknown): OperationArtifactConfig {
	const fallback = makeDefaultArtifactOutput(opId, kind);
	if (!currentValue || typeof currentValue !== 'object') return fallback;
	return {
		...fallback,
		...(currentValue as OperationArtifactConfig),
		format: requiresJsonArtifactFormat(kind)
			? 'json'
			: ((currentValue as OperationArtifactConfig).format ?? fallback.format),
	};
}

export const OperationEditor: React.FC<Props> = memo(({ index, title, status, canSave, canDiscard, onSave, onDiscard, onRemove }) => {
	const { t } = useTranslation();
	const opId = useWatch({ name: `operations.${index}.opId` }) as unknown;
	const artifact = useWatch({ name: `operations.${index}.config.params.artifact` }) as unknown;
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
		<Stack gap="md">
			<Stack gap="xs" className="op-operationHeader">
				<Group gap="xs" wrap="wrap">
					<Text fw={700}>{title ?? t('operationProfiles.operationEditor.title')}</Text>
					{status && (
						<>
							<Badge variant="light">#{status.index}</Badge>
							<Badge variant="outline">{t(`operationProfiles.kind.${status.kind}`)}</Badge>
							{status.isDirty && <Badge color="yellow">{t('operationProfiles.operationEditor.unsaved')}</Badge>}
						</>
					)}
				</Group>

				<Group gap="xs" wrap="wrap" className="op-operationActions">
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
							icon={<TrashIcon />}
							colorPalette="red"
							size="input-sm"
							variant="ghost"
							tooltipSettings={ACTION_TOOLTIP_SETTINGS}
							onClick={onRemove}
						/>
					)}
				</Group>
			</Stack>

			<Group wrap="wrap" gap="sm" align="flex-end" className="op-operationIdentityRow">
				<FormInput
					name={`operations.${index}.name`}
					label={t('operationProfiles.fields.operationName')}
					fieldProps={{ style: { flex: 1, minWidth: 260 } }}
				/>
				<Select
					{...kindField}
					label={t('operationProfiles.fields.kind')}
					data={OPERATION_KIND_OPTIONS.map((kind) => ({ value: kind, label: t(`operationProfiles.kind.${kind}`) }))}
					value={normalizedKind}
					onChange={(next) => {
						const nextKind: OperationKind = isOperationKind(next) ? next : 'template';
						onKindChange(nextKind);

						const safeArtifact = resolveArtifactForKind(safeOpId || 'temp-op', nextKind, artifact);

						if (nextKind === 'template') {
							const nextParams: FormTemplateParams = {
								template: '',
								strictVariables: false,
								artifact: safeArtifact as FormTemplateParams['artifact'],
							};
							setValue(`operations.${index}.config.params`, nextParams, { shouldDirty: true });
							return;
						}

						if (nextKind === 'llm') {
							const nextParams: FormLlmKindParams = makeDefaultLlmKindParams(
								safeOpId || 'temp-op',
								safeArtifact,
							);
							setValue(`operations.${index}.config.params`, nextParams, { shouldDirty: true });
							return;
						}

						if (nextKind === 'guard') {
							const nextParams: FormGuardKindParams = makeDefaultGuardKindParams(safeOpId || 'temp-op', safeArtifact);
							setValue(`operations.${index}.config.params`, nextParams, { shouldDirty: true });
							return;
						}

						if (isKnowledgeOperationKind(nextKind)) {
							const nextParams: FormKnowledgeKindParams = makeDefaultKnowledgeKindParams(
								safeOpId || 'temp-op',
								nextKind,
								safeArtifact,
							);
							setValue(`operations.${index}.config.params`, nextParams, { shouldDirty: true });
							return;
						}

						const nextParams: FormOtherKindParams = makeDefaultOtherKindParams(
							safeOpId || 'temp-op',
							nextKind as Exclude<
								OperationKind,
								'template' | 'llm' | 'guard' | 'knowledge_search' | 'knowledge_reveal'
							>,
							safeArtifact,
						);
						setValue(`operations.${index}.config.params`, nextParams, { shouldDirty: true });
					}}
					comboboxProps={{ withinPortal: false }}
					description={t('operationProfiles.fields.kindDescription')}
					style={{ width: 230, flexShrink: 0 }}
				/>
			</Group>

			<Text size="xs" c="dimmed" className="op-opIdText">
				{t('operationProfiles.fields.opId', { value: safeOpId || '-' })}
			</Text>

			<OperationSectionsAccordion index={index} kind={normalizedKind} />
		</Stack>
	);
});

OperationEditor.displayName = 'OperationEditor';


