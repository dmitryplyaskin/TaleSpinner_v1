import React, { memo } from 'react';
import { useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { OperationRow } from './operation-row';

import type { OperationKind } from '@shared/types/operation-profiles';

type Props = {
	index: number;
	opId: string;
	selected: boolean;
	onSelect: (opId: string) => void;
};

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

export const OperationRowContainer: React.FC<Props> = memo(({ index, opId, selected, onSelect }) => {
	const { t } = useTranslation();
	const [nameValue, kindValue, enabledValue, requiredValue, dependsOnValue] = useWatch({
		name: [
			`operations.${index}.name`,
			`operations.${index}.kind`,
			`operations.${index}.config.enabled`,
			`operations.${index}.config.required`,
			`operations.${index}.config.dependsOn`,
		],
	}) as [unknown, unknown, unknown, unknown, unknown];

	const normalizedKind: OperationKind = isOperationKind(kindValue) ? kindValue : 'template';
	const displayName =
		typeof nameValue === 'string' && nameValue.trim().length > 0
			? nameValue.trim()
			: t('operationProfiles.defaults.untitledOperation');
	const depsCount = Array.isArray(dependsOnValue) ? dependsOnValue.length : 0;

	return (
		<OperationRow
			opId={opId}
			index={index}
			name={displayName}
			kind={normalizedKind}
			enabled={Boolean(enabledValue)}
			required={Boolean(requiredValue)}
			depsCount={depsCount}
			selected={selected}
			onSelect={onSelect}
		/>
	);
});

OperationRowContainer.displayName = 'OperationRowContainer';
