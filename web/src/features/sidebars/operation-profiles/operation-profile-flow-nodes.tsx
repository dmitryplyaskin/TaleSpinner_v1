import React, { memo } from 'react';

import { Handle, Position, type NodeProps } from '@xyflow/react';

export type OperationFlowNodeData = {
	opId: string;
	name: string;
	description?: string;
	kind: string;
	isEnabled: boolean;
	isRequired: boolean;
};

export const OperationFlowNode: React.FC<NodeProps> = memo(({ data, selected }) => {
	const d = data as OperationFlowNodeData;
	return (
		<div
			style={{
				width: 260,
				borderRadius: 12,
				padding: 12,
				border: selected ? '2px solid #4C6EF5' : '1px solid rgba(0,0,0,0.15)',
				background: 'rgba(255,255,255,0.92)',
				boxShadow: selected ? '0 8px 24px rgba(76,110,245,0.25)' : '0 8px 24px rgba(0,0,0,0.08)',
				position: 'relative',
			}}
		>
			{/* dependsOn: incoming edges -> target handle on the left */}
			<Handle type="target" position={Position.Left} style={{ width: 10, height: 10, border: '2px solid #4C6EF5' }} />
			{/* outgoing edges -> source handle on the right */}
			<Handle type="source" position={Position.Right} style={{ width: 10, height: 10, border: '2px solid #4C6EF5' }} />

			<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
				<div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
				<div
					style={{
						fontSize: 12,
						padding: '2px 8px',
						borderRadius: 999,
						background: 'rgba(0,0,0,0.06)',
						whiteSpace: 'nowrap',
					}}
				>
					{d.kind}
				</div>
			</div>

			<div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
				<div
					style={{
						fontSize: 12,
						padding: '2px 8px',
						borderRadius: 999,
						background: d.isEnabled ? 'rgba(34,139,34,0.12)' : 'rgba(220,0,0,0.10)',
						color: d.isEnabled ? '#1B5E20' : '#8A0000',
					}}
				>
					{d.isEnabled ? 'enabled' : 'disabled'}
				</div>
				{d.isRequired && (
					<div style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,193,7,0.18)', color: '#7A5D00' }}>
						required
					</div>
				)}
			</div>

			{d.description?.trim() ? (
				<div
					style={{
						marginTop: 8,
						fontSize: 12,
						opacity: 0.85,
						display: '-webkit-box',
						WebkitLineClamp: 3,
						WebkitBoxOrient: 'vertical',
						overflow: 'hidden',
					}}
				>
					{d.description}
				</div>
			) : null}

			<div style={{ marginTop: 8, fontSize: 11, opacity: 0.65, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
				{d.opId}
			</div>
		</div>
	);
});

OperationFlowNode.displayName = 'OperationFlowNode';

