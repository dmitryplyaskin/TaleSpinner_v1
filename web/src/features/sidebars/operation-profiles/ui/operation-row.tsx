import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';

import type { OperationListItemVm } from './types';

type OperationRowProps = {
	item: OperationListItemVm;
	selected: boolean;
	onSelect: (opId: string) => void;
};

export const OperationRow: React.FC<OperationRowProps> = memo(({ item, selected, onSelect }) => {
	return (
		<Paper
			withBorder
			p="sm"
			role="button"
			tabIndex={0}
			className="op-listRow op-focusRing"
			data-selected={selected}
			onClick={() => onSelect(item.opId)}
			onKeyDown={(event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					onSelect(item.opId);
				}
			}}
		>
			<Group justify="space-between" wrap="nowrap" gap="xs">
				<Stack gap={2} style={{ minWidth: 0 }}>
					<Text size="sm" fw={700} lineClamp={1}>
						{item.name}
					</Text>
					<Text className="op-rowMeta" lineClamp={1}>
						{item.opId}
					</Text>
				</Stack>

				<Group gap={6} wrap="wrap" justify="flex-end">
					<Badge size="sm" variant="light">
						#{item.index + 1}
					</Badge>
					<Badge size="sm" variant="outline">
						{item.kind}
					</Badge>
					{!item.enabled && (
						<Badge size="sm" color="gray" variant="filled">
							disabled
						</Badge>
					)}
					{item.required && (
						<Badge size="sm" color="orange" variant="filled">
							required
						</Badge>
					)}
					{item.depsCount > 0 && (
						<Badge size="sm" color="violet" variant="light">
							deps {item.depsCount}
						</Badge>
					)}
				</Group>
			</Group>
		</Paper>
	);
});

OperationRow.displayName = 'OperationRow';
