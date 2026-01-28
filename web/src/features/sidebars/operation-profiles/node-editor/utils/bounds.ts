import type { Node } from '@xyflow/react';

export type NodeBounds = { x: number; y: number; width: number; height: number };

type NodeLike = Pick<Node, 'position'> &
	Partial<
		Pick<Node, 'width' | 'height'> & {
			measured?: { width?: number; height?: number } | null;
		}
	>;

function pickFinite(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function computeBoundsFromNodes(
	nodes: readonly NodeLike[],
	fallbackSize: { width: number; height: number } = { width: 260, height: 140 },
): NodeBounds | null {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const n of nodes) {
		const x = pickFinite(n?.position?.x);
		const y = pickFinite(n?.position?.y);
		if (x === null || y === null) continue;

		const w =
			pickFinite(n?.width) ??
			pickFinite(n?.measured?.width) ??
			(typeof fallbackSize.width === 'number' && Number.isFinite(fallbackSize.width) ? fallbackSize.width : 260);

		const h =
			pickFinite(n?.height) ??
			pickFinite(n?.measured?.height) ??
			(typeof fallbackSize.height === 'number' && Number.isFinite(fallbackSize.height) ? fallbackSize.height : 140);

		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + w);
		maxY = Math.max(maxY, y + h);
	}

	if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}


