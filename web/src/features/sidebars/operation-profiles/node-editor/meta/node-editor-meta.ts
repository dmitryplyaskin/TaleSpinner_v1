export type OperationProfileNodeEditorMetaV1 = {
	version: 1;
	nodes: Record<string, { x: number; y: number }>;
	groups?: Record<string, { name: string; nodeIds: string[]; bg?: string }>;
	viewport?: { x: number; y: number; zoom: number };
};

type MetaObject = Record<string, unknown>;

function isRecord(v: unknown): v is Record<string, unknown> {
	return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

export function readNodeEditorMeta(meta: unknown): OperationProfileNodeEditorMetaV1 | null {
	if (!isRecord(meta)) return null;
	const nodeEditor = meta.nodeEditor;
	if (!isRecord(nodeEditor)) return null;
	if (nodeEditor.version !== 1) return null;
	const nodesRaw = nodeEditor.nodes;
	if (!isRecord(nodesRaw)) return null;

	const nodes: Record<string, { x: number; y: number }> = {};
	for (const [opId, pos] of Object.entries(nodesRaw)) {
		if (!isRecord(pos)) continue;
		const x = typeof pos.x === 'number' ? pos.x : NaN;
		const y = typeof pos.y === 'number' ? pos.y : NaN;
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
		nodes[opId] = { x, y };
	}

	const viewportRaw = nodeEditor.viewport;
	const viewport =
		isRecord(viewportRaw) &&
		typeof viewportRaw.x === 'number' &&
		typeof viewportRaw.y === 'number' &&
		typeof viewportRaw.zoom === 'number'
			? { x: viewportRaw.x, y: viewportRaw.y, zoom: viewportRaw.zoom }
			: undefined;

	const groupsRaw = nodeEditor.groups;
	let groups: OperationProfileNodeEditorMetaV1['groups'] | undefined;
	if (isRecord(groupsRaw)) {
		const out: Record<string, { name: string; nodeIds: string[]; bg?: string }> = {};
		for (const [groupId, g] of Object.entries(groupsRaw)) {
			if (!isRecord(g)) continue;
			const name = typeof g.name === 'string' ? g.name : '';
			const nodeIdsRaw = g.nodeIds;
			const nodeIds = Array.isArray(nodeIdsRaw) ? nodeIdsRaw.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
			if (!groupId || !name.trim() || nodeIds.length === 0) continue;

			const bgRaw = (g as Record<string, unknown>).bg;
			const bg = typeof bgRaw === 'string' && bgRaw.trim() ? bgRaw.trim() : undefined;

			out[groupId] = { name: name.trim(), nodeIds: [...new Set(nodeIds)], bg };
		}
		if (Object.keys(out).length) groups = out;
	}

	return { version: 1, nodes, groups, viewport };
}

export function writeNodeEditorMeta(existingMeta: unknown, nodeEditor: OperationProfileNodeEditorMetaV1): unknown {
	const base: MetaObject = isRecord(existingMeta) ? { ...(existingMeta as MetaObject) } : {};
	return { ...base, nodeEditor };
}

export function computeSimpleLayout(opIds: string[], deps: Array<{ source: string; target: string }>): Record<string, { x: number; y: number }> {
	const incoming = new Map<string, Set<string>>();
	const outgoing = new Map<string, Set<string>>();
	for (const id of opIds) {
		incoming.set(id, new Set());
		outgoing.set(id, new Set());
	}
	for (const { source, target } of deps) {
		if (!incoming.has(target) || !outgoing.has(source)) continue;
		incoming.get(target)!.add(source);
		outgoing.get(source)!.add(target);
	}

	// Kahn-like level assignment (best-effort, cycles -> fallback to index).
	const indeg = new Map<string, number>();
	for (const id of opIds) indeg.set(id, incoming.get(id)!.size);

	const queue: string[] = opIds.filter((id) => (indeg.get(id) ?? 0) === 0);
	const level = new Map<string, number>();
	for (const id of queue) level.set(id, 0);

	const seen = new Set<string>();
	while (queue.length) {
		const cur = queue.shift()!;
		seen.add(cur);
		const curLevel = level.get(cur) ?? 0;
		for (const next of outgoing.get(cur) ?? []) {
			indeg.set(next, Math.max(0, (indeg.get(next) ?? 0) - 1));
			level.set(next, Math.max(level.get(next) ?? 0, curLevel + 1));
			if ((indeg.get(next) ?? 0) === 0) queue.push(next);
		}
	}

	for (const id of opIds) {
		if (!seen.has(id)) level.set(id, 0);
	}

	const byLevel = new Map<number, string[]>();
	for (const id of opIds) {
		const l = level.get(id) ?? 0;
		const arr = byLevel.get(l) ?? [];
		arr.push(id);
		byLevel.set(l, arr);
	}

	const xStep = 320;
	const yStep = 160;
	const positions: Record<string, { x: number; y: number }> = {};
	for (const [l, ids] of [...byLevel.entries()].sort((a, b) => a[0] - b[0])) {
		ids.forEach((id, idx) => {
			positions[id] = { x: l * xStep, y: idx * yStep };
		});
	}
	return positions;
}

