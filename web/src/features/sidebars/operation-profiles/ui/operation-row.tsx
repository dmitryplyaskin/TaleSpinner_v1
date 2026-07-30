import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';

import type { OperationKind } from '@shared/types/operation-profiles';

type OperationRowProps = {
	opId: string;
	index: number;
	name: string;
	kind: OperationKind;
	enabled: boolean;
	required: boolean;
	depsCount: number;
	selected: boolean;
	onSelect: (opId: string) => void;
};

export const OperationRow: React.FC<OperationRowProps> = memo(({ opId, index, name, kind, enabled, required, depsCount, selected, onSelect }) => {
	const { t } = useTranslation();
	return (
		<Paper
			withBorder
			p="sm"
			role="button"
			tabIndex={0}
			className="op-listRow op-focusRing"
			data-selected={selected}
			onClick={() => onSelect(opId)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					onSelect(opId);
				}
			}}
		>
			<Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
				<Stack gap={2} style={{ minWidth: 0 }}>
					<Text size="sm" fw={700} lineClamp={1}>
						{name}
					</Text>
					<Text className="op-rowMeta" lineClamp={1}>
						{t(`operationProfiles.kind.${kind}`)}
					</Text>
				</Stack>

				<Badge size="sm" variant="light">
					#{index + 1}
				</Badge>
			</Group>
			{(!enabled || required || depsCount > 0) && (
				<Group gap={6} wrap="wrap" mt="xs">
					{!enabled && (
						<Badge size="sm" color="gray" variant="filled">
							{t('operationProfiles.status.disabled')}
						</Badge>
					)}
					{required && (
						<Badge size="sm" color="orange" variant="filled">
							{t('operationProfiles.sectionsLabels.required')}
						</Badge>
					)}
					{depsCount > 0 && (
						<Badge size="sm" color="violet" variant="light">
							{t('operationProfiles.operations.dependencies', { count: depsCount })}
						</Badge>
					)}
				</Group>
			)}
		</Paper>
	);
});

OperationRow.displayName = 'OperationRow';
