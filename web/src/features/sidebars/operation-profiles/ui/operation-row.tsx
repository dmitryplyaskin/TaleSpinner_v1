import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';

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
			<Group justify="space-between" wrap="nowrap" gap="xs">
				<Stack gap={2} style={{ minWidth: 0 }}>
					<Text size="sm" fw={700} lineClamp={1}>
						{name}
					</Text>
					<Text className="op-rowMeta" lineClamp={1}>
						{opId}
					</Text>
				</Stack>

				<Group gap={6} wrap="wrap" justify="flex-end">
					<Badge size="sm" variant="light">
						#{index + 1}
					</Badge>
					<Badge size="sm" variant="outline">
						{kind}
					</Badge>
					{!enabled && (
						<Badge size="sm" color="gray" variant="filled">
							disabled
						</Badge>
					)}
					{required && (
						<Badge size="sm" color="orange" variant="filled">
							required
						</Badge>
					)}
					{depsCount > 0 && (
						<Badge size="sm" color="violet" variant="light">
							deps {depsCount}
						</Badge>
					)}
				</Group>
			</Group>
		</Paper>
	);
});

OperationRow.displayName = 'OperationRow';
