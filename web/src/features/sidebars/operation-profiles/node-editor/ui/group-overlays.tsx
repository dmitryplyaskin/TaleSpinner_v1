import { Badge } from '@mantine/core';
import { ViewportPortal } from '@xyflow/react';
import React from 'react';

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
								border: isActive ? '2px solid rgba(47,116,208,0.9)' : '1px dashed rgba(26,53,89,0.28)',
								background: colors.bg,
								pointerEvents: 'none',
								boxShadow: isActive ? '0 8px 20px rgba(47,116,208,0.16)' : 'none',
								zIndex: 10,
							}}
						/>
						<div
							style={{
								position: 'absolute',
								left: bounds.x - pad,
								top: bounds.y - pad - badgeH - gap,
								pointerEvents: 'auto',
								zIndex: 2000,
							}}
						>
							<Badge
								variant="filled"
								radius="sm"
								style={{
									cursor: 'pointer',
									userSelect: 'none',
									background: colors.base,
									boxShadow: '0 6px 14px rgba(19, 33, 54, 0.24)',
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

