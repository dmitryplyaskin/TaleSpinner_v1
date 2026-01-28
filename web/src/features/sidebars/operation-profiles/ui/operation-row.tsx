import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import React, { memo } from 'react';
import { useWatch } from 'react-hook-form';

export type OperationRowProps = {
	index: number;
	opId: string;
	selected: boolean;
	onSelect: (opId: string) => void;
};

export const OperationRow: React.FC<OperationRowProps> = memo(({ index, opId, selected, onSelect }) => {
	const name = useWatch({ name: `operations.${index}.name` }) as unknown;
	const kind = useWatch({ name: `operations.${index}.kind` }) as unknown;
	const enabled = useWatch({ name: `operations.${index}.config.enabled` }) as unknown;
	const required = useWatch({ name: `operations.${index}.config.required` }) as unknown;
	const dependsOn = useWatch({ name: `operations.${index}.config.dependsOn` }) as unknown;

	const nameLabel = typeof name === 'string' && name.trim() ? name.trim() : '(unnamed)';
	const kindLabel = typeof kind === 'string' && kind ? kind : '—';
	const isEnabled = Boolean(enabled);
	const isRequired = Boolean(required);
	const depsCount = Array.isArray(dependsOn) ? dependsOn.length : 0;

	return (
		<Paper
			withBorder
			p="sm"
			onClick={() => onSelect(opId)}
			style={{
				cursor: 'pointer',
				userSelect: 'none',
				borderColor: selected ? 'var(--mantine-color-blue-6)' : undefined,
				background: selected ? 'var(--mantine-color-blue-light)' : undefined,
			}}
		>
			<Group justify="space-between" wrap="nowrap" gap="xs">
				<Stack gap={2} style={{ minWidth: 0 }}>
					<Text size="sm" fw={600} lineClamp={1}>
						{nameLabel}
					</Text>
					<Text size="xs" c="dimmed" lineClamp={1}>
						{opId}
					</Text>
				</Stack>

				<Group gap={6} wrap="wrap" justify="flex-end">
					<Badge size="sm" variant="light">
						#{index + 1}
					</Badge>
					<Badge size="sm" variant="outline">
						{kindLabel}
					</Badge>
					{!isEnabled && (
						<Badge size="sm" color="gray" variant="filled">
							disabled
						</Badge>
					)}
					{isRequired && (
						<Badge size="sm" color="orange" variant="filled">
							required
						</Badge>
					)}
					{depsCount > 0 && (
						<Badge size="sm" color="violet" variant="light">
							deps: {depsCount}
						</Badge>
					)}
				</Group>
			</Group>
		</Paper>
	);
});

OperationRow.displayName = 'OperationRow';

