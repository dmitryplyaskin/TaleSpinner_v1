import { Badge } from '@mantine/core';
import { ViewportPortal } from '@xyflow/react';
import React from 'react';

import { Z_INDEX } from '@ui/z-index';

import { DEFAULT_GROUP_COLOR_HEX, getGroupColors } from '../utils/color';

import type { NodeBounds } from '../utils/bounds';

export type EditorGroup = { name: string; nodeIds: string[]; bg?: string };

type Props = {
	groups: Record<string, EditorGroup>;
	selectedGroupId: string | null;
	groupBgAlpha: number;
	computeBounds: (nodeIds: string[]) => NodeBounds | null;
	onLabelPointerDown: (e: React.PointerEvent, groupId: string) => void;
	onLabelPointerMove: (e: React.PointerEvent) => void;
	onLabelPointerUp: (e: React.PointerEvent, groupId: string) => void;
};

const GroupOverlaysImpl: React.FC<Props> = ({
	groups,
	selectedGroupId,
	groupBgAlpha,
	computeBounds,
	onLabelPointerDown,
	onLabelPointerMove,
	onLabelPointerUp,
}) => {
	return (
		<ViewportPortal>
			{Object.entries(groups).map(([groupId, g]) => {
				const bounds = computeBounds(g.nodeIds);
				if (!bounds) return null;

				const pad = 24;
				const badgeH = 26;
				const gap = 8;
				const isActive = selectedGroupId === groupId;
				const colors = getGroupColors(g.bg, { alpha: groupBgAlpha, fallbackHex: DEFAULT_GROUP_COLOR_HEX });

				return (
					<div key={groupId}>
						<div
							style={{
								position: 'absolute',
								left: bounds.x - pad,
								top: bounds.y - pad,
								width: bounds.width + pad * 2,
								height: bounds.height + pad * 2,
								borderRadius: 14,
								border: isActive
									? '2px solid var(--ts-node-group-border-active)'
									: '1px dashed var(--ts-node-group-border)',
								background: colors.bg,
								pointerEvents: 'none',
								boxShadow: isActive ? '0 8px 20px var(--ts-node-group-shadow-active)' : 'none',
								zIndex: Z_INDEX.flow.groupOverlay,
							}}
						/>
						<div
							style={{
								position: 'absolute',
								left: bounds.x - pad,
								top: bounds.y - pad - badgeH - gap,
								pointerEvents: 'auto',
								zIndex: Z_INDEX.flow.groupLabel,
							}}
						>
							<Badge
								variant="filled"
								radius="sm"
								style={{
									cursor: 'pointer',
									userSelect: 'none',
									background: colors.base,
									boxShadow: '0 6px 14px var(--ts-node-group-badge-shadow)',
								}}
								onPointerDown={(e) => onLabelPointerDown(e, groupId)}
								onPointerMove={(e) => onLabelPointerMove(e)}
								onPointerUp={(e) => onLabelPointerUp(e, groupId)}
							>
								{g.name}
							</Badge>
						</div>
					</div>
				);
			})}
		</ViewportPortal>
	);
};

export const GroupOverlays = React.memo(GroupOverlaysImpl);
GroupOverlays.displayName = 'GroupOverlays';

