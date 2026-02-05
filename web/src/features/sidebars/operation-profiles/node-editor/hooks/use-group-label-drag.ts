import { useCallback, useRef } from 'react';

import type { Node, ReactFlowInstance } from '@xyflow/react';
import type React from 'react';

type DragState = {
	groupId: string;
	pointerId: number;
	startClient: { x: number; y: number };
	startFlow: { x: number; y: number };
	startPositions: Record<string, { x: number; y: number }>;
	didDrag: boolean;
};

type FlowPoint = { x: number; y: number };

function hasScreenToFlow(flow: ReactFlowInstance | null): flow is ReactFlowInstance & { screenToFlowPosition: (p: FlowPoint) => FlowPoint } {
	return Boolean(flow && typeof (flow as unknown as { screenToFlowPosition?: unknown }).screenToFlowPosition === 'function');
}

export function useGroupLabelDrag<TData extends Record<string, unknown>>(params: {
	flow: ReactFlowInstance | null;
	groups: Record<string, { nodeIds: string[] }>;
	nodesRef: React.MutableRefObject<Array<Node<TData>>>;
	setNodes: React.Dispatch<React.SetStateAction<Array<Node<TData>>>>;
	onSelectGroup: (groupId: string) => void;
	onOpenGroupEditor: (groupId: string) => void;
	markLayoutDirty: () => void;
}) {
	const { flow, groups, nodesRef, setNodes, onSelectGroup, onOpenGroupEditor, markLayoutDirty } = params;

	const dragRef = useRef<DragState | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastDeltaRef = useRef<FlowPoint>({ x: 0, y: 0 });

	const flushRaf = useCallback(() => {
		rafRef.current = null;
		const drag = dragRef.current;
		if (!drag) return;

		const delta = lastDeltaRef.current;
		setNodes((prev) => {
			let changed = false;
			const next = prev.slice();
			for (let i = 0; i < next.length; i++) {
				const n = next[i];
				const id = String(n.id);
				const start = drag.startPositions[id];
				if (!start) continue;
				changed = true;
				next[i] = { ...n, position: { x: start.x + delta.x, y: start.y + delta.y } };
			}
			return changed ? next : prev;
		});
		markLayoutDirty();
	}, [markLayoutDirty, setNodes]);

	const scheduleRaf = useCallback(() => {
		if (rafRef.current !== null) return;
		rafRef.current = window.requestAnimationFrame(flushRaf);
	}, [flushRaf]);

	const onPointerDown = useCallback(
		(e: React.PointerEvent, groupId: string) => {
			onSelectGroup(groupId);
			if (!hasScreenToFlow(flow)) {
				dragRef.current = null;
				return;
			}

			const g = groups[groupId];
			if (!g) return;

			const ids = new Set(g.nodeIds ?? []);
			const startPositions: Record<string, { x: number; y: number }> = {};
			for (const n of nodesRef.current) {
				const id = String(n.id);
				if (!ids.has(id)) continue;
				startPositions[id] = { x: n.position.x, y: n.position.y };
			}

			const startFlow = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
			dragRef.current = {
				groupId,
				pointerId: e.pointerId,
				startClient: { x: e.clientX, y: e.clientY },
				startFlow,
				startPositions,
				didDrag: false,
			};

			try {
				e.currentTarget.setPointerCapture(e.pointerId);
			} catch {
				// ignore
			}

			e.preventDefault();
			e.stopPropagation();
		},
		[flow, groups, nodesRef, onSelectGroup],
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) return;
			if (drag.pointerId !== e.pointerId) return;
			if (!hasScreenToFlow(flow)) return;

			const dx = e.clientX - drag.startClient.x;
			const dy = e.clientY - drag.startClient.y;
			const threshold = 4;
			if (!drag.didDrag && Math.hypot(dx, dy) >= threshold) drag.didDrag = true;

			if (!drag.didDrag) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			const curFlow = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
			lastDeltaRef.current = { x: curFlow.x - drag.startFlow.x, y: curFlow.y - drag.startFlow.y };
			scheduleRaf();

			e.preventDefault();
			e.stopPropagation();
		},
		[flow, scheduleRaf],
	);

	const onPointerUp = useCallback(
		(e: React.PointerEvent, groupId: string) => {
			const drag = dragRef.current;
			dragRef.current = null;

			if (!drag || drag.pointerId !== e.pointerId) return;

			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				// ignore
			}

			if (rafRef.current !== null) {
				window.cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}

			if (!drag.didDrag) onOpenGroupEditor(groupId);

			e.preventDefault();
			e.stopPropagation();
		},
		[onOpenGroupEditor],
	);

	return { onPointerDown, onPointerMove, onPointerUp };
}

