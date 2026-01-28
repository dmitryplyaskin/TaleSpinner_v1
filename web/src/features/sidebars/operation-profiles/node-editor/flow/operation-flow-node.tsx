import { Badge, Group, Paper, Stack, Text } from '@mantine/core';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import React, { memo } from 'react';

export type OperationFlowNodeData = {
	opId: string;
	name: string;
	description?: string;
	kind: string;
	isEnabled: boolean;
	isRequired: boolean;
};

const NODE_WIDTH = 260;
const HANDLE_STYLE: React.CSSProperties = { width: 10, height: 10, border: '2px solid var(--mantine-color-blue-6)' };

export const OperationFlowNode: React.FC<NodeProps> = memo(({ data, selected }) => {
	const d = data as OperationFlowNodeData;
	return (
		<Paper
			withBorder
			shadow={selected ? 'md' : 'sm'}
			radius="md"
			p="sm"
			style={{
				width: NODE_WIDTH,
				position: 'relative',
				borderWidth: selected ? 2 : 1,
				borderColor: selected ? 'var(--mantine-color-blue-6)' : undefined,
			}}
		>
			{/* dependsOn: incoming edges -> target handle on the left */}
			<Handle type="target" position={Position.Left} style={HANDLE_STYLE} />
			{/* outgoing edges -> source handle on the right */}
			<Handle type="source" position={Position.Right} style={HANDLE_STYLE} />

			<Stack gap={6}>
				<Group justify="space-between" wrap="nowrap" gap="xs">
					<Text fw={700} size="sm" lineClamp={1} style={{ minWidth: 0 }}>
						{d.name}
					</Text>
					<Badge size="sm" variant="light">
						{d.kind}
					</Badge>
				</Group>

				<Group gap={6} wrap="wrap">
					<Badge size="sm" color={d.isEnabled ? 'green' : 'gray'} variant="light">
						{d.isEnabled ? 'enabled' : 'disabled'}
					</Badge>
					{d.isRequired && (
						<Badge size="sm" color="orange" variant="light">
							required
						</Badge>
					)}
				</Group>

				{d.description?.trim() ? (
					<Text size="xs" c="dimmed" lineClamp={3}>
						{d.description}
					</Text>
				) : null}

				<Text size="xs" c="dimmed" lineClamp={1}>
					{d.opId}
				</Text>
			</Stack>
		</Paper>
	);
});

OperationFlowNode.displayName = 'OperationFlowNode';

