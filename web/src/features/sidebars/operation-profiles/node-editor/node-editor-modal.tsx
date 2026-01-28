import '@xyflow/react/dist/style.css';

import { Alert, Badge, Button, Divider, Group, Modal, ScrollArea, Select, Stack, Text, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { LuLayoutDashboard, LuPlus, LuSave, LuTrash2, LuX } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import type { OperationProfileDto } from '../../../../api/chat-core';

import { updateOperationProfileFx } from '@model/operation-profiles';
import {
	Background,
	ConnectionLineType,
	Controls,
	ViewportPortal,
	type Edge,
	type EdgeChange,
	MarkerType,
	type Node,
	type NodeChange,
	Panel,
	ReactFlow,
	ReactFlowProvider,
	type Connection,
	type ReactFlowInstance,
	useNodesState,
} from '@xyflow/react';

import { fromOperationProfileForm, makeDefaultOperation, toOperationProfileForm, type OperationProfileFormValues } from '../form/operation-profile-form-mapping';
import { OperationEditor } from '../ui/operation-editor/operation-editor';
import { OperationFlowNode, type OperationFlowNodeData } from './flow/operation-flow-node';
import { computeSimpleLayout, readNodeEditorMeta, writeNodeEditorMeta } from './meta/node-editor-meta';

type Props = {
	opened: boolean;
	onClose: () => void;
	profile: OperationProfileDto;
};

type OpEdge = { source: string; target: string };

type EditorGroup = { name: string; nodeIds: string[]; bg?: string };

const DEFAULT_GROUP_COLOR = '#4c6ef5';
const GROUP_BG_ALPHA = 0.08;

function parseCssColorToRgb(input: string): { r: number; g: number; b: number } | null {
	if (typeof document === 'undefined') return null;

	const raw = (input ?? '').trim();
	if (!raw) return null;

	// Canvas normalizes CSS colors (including named colors, hsl, etc).
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;

	const before = ctx.fillStyle;
	try {
		ctx.fillStyle = raw;
	} catch {
		return null;
	}
	const normalized = String(ctx.fillStyle);

	// Invalid colors keep previous value.
	if (normalized === String(before)) {
		// Try with a known sentinel.
		ctx.fillStyle = '#000';
		const sentinel = String(ctx.fillStyle);
		try {
			ctx.fillStyle = raw;
		} catch {
			return null;
		}
		if (String(ctx.fillStyle) === sentinel) return null;
	}

	if (normalized.startsWith('#')) {
		const hex = normalized.slice(1);
		if (hex.length === 3) {
			const r = parseInt(hex[0] + hex[0], 16);
			const g = parseInt(hex[1] + hex[1], 16);
			const b = parseInt(hex[2] + hex[2], 16);
			if ([r, g, b].every(Number.isFinite)) return { r, g, b };
			return null;
		}
		if (hex.length === 6) {
			const r = parseInt(hex.slice(0, 2), 16);
			const g = parseInt(hex.slice(2, 4), 16);
			const b = parseInt(hex.slice(4, 6), 16);
			if ([r, g, b].every(Number.isFinite)) return { r, g, b };
			return null;
		}
	}

	// rgb(...) or rgba(...)
	const m = normalized.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
	if (m) {
		const r = Number(m[1]);
		const g = Number(m[2]);
		const b = Number(m[3]);
		if ([r, g, b].every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) return { r, g, b };
	}

	return null;
}

function getGroupColors(baseColor: string | undefined): { base: string; bg: string } {
	const rgb = parseCssColorToRgb(baseColor ?? '') ?? parseCssColorToRgb(DEFAULT_GROUP_COLOR) ?? { r: 76, g: 110, b: 245 };
	const base = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
	const bg = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${GROUP_BG_ALPHA})`;
	return { base, bg };
}

function buildEdges(operations: Array<{ opId: string; config?: { dependsOn?: string[] } }>): Edge[] {
	const edges: Edge[] = [];
	for (const op of operations) {
		const target = op.opId;
		const dependsOn = Array.isArray(op.config?.dependsOn) ? op.config!.dependsOn! : [];
		for (const source of dependsOn) {
			if (!source || source === target) continue;
			edges.push({
				id: `${source}=>${target}`,
				source,
				target,
				animated: false,
				markerEnd: { type: MarkerType.ArrowClosed },
				style: { strokeWidth: 2 },
			});
		}
	}
	return edges;
}

function edgesToDeps(edges: Edge[]): OpEdge[] {
	return edges.map((e) => ({ source: e.source, target: e.target }));
}

function removeOpIdFromAllDependsOn(values: OperationProfileFormValues, removedOpId: string): OperationProfileFormValues {
	return {
		...values,
		operations: values.operations.map((op) => ({
			...op,
			config: {
				...op.config,
				dependsOn: op.config.dependsOn.filter((id) => id !== removedOpId),
			},
		})),
	};
}

function extractOpIds(values: OperationProfileFormValues): string[] {
	return values.operations.map((o) => o.opId).filter(Boolean);
}

function isTextEditingTarget(target: EventTarget | null): boolean {
	if (!target || !(target instanceof HTMLElement)) return false;
	if (target.isContentEditable) return true;
	const tag = target.tagName.toLowerCase();
	if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
	return Boolean(target.closest?.('[contenteditable="true"]'));
}

function computeBoundsFromNodes(nodes: any[]): { x: number; y: number; width: number; height: number } | null {
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	for (const n of nodes) {
		const pos = n?.position;
		const x = typeof pos?.x === 'number' ? pos.x : NaN;
		const y = typeof pos?.y === 'number' ? pos.y : NaN;
		if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

		const w = (typeof n?.width === 'number' && Number.isFinite(n.width) ? n.width : undefined) ?? (typeof n?.measured?.width === 'number' ? n.measured.width : undefined) ?? 260;
		const h =
			(typeof n?.height === 'number' && Number.isFinite(n.height) ? n.height : undefined) ?? (typeof n?.measured?.height === 'number' ? n.measured.height : undefined) ?? 140;

		minX = Math.min(minX, x);
		minY = Math.min(minY, y);
		maxX = Math.max(maxX, x + w);
		maxY = Math.max(maxY, y + h);
	}

	if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return null;
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export const OperationProfileNodeEditorModal: React.FC<Props> = ({ opened, onClose, profile }) => {
	const doUpdate = useUnit(updateOperationProfileFx);

	const initial = useMemo(() => toOperationProfileForm(profile), [profile]);
	const methods = useForm<OperationProfileFormValues>({ defaultValues: initial });
	const { control, formState, setValue } = methods;

	const { append, replace } = useFieldArray({ name: 'operations', control, keyName: '_key' });
	const operations = useWatch({ control, name: 'operations' }) as OperationProfileFormValues['operations'] | undefined;

	const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
	const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
	const [groups, setGroups] = useState<Record<string, EditorGroup>>({});
	const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [isLayoutDirty, setIsLayoutDirty] = useState(false);
	const [flow, setFlow] = useState<ReactFlowInstance | null>(null);
	const [groupEditor, setGroupEditor] = useState<{ groupId: string; name: string; bg: string } | null>(null);

	const connectingSourceIdRef = useRef<string | null>(null);
	const didConnectRef = useRef(false);
	const flowWrapperRef = useRef<HTMLDivElement | null>(null);
	const nodesRef = useRef<Array<Node<OperationFlowNodeData>>>([]);
	const groupLabelDragRef = useRef<{
		groupId: string;
		pointerId: number;
		startClient: { x: number; y: number };
		startFlow: { x: number; y: number };
		startPositions: Record<string, { x: number; y: number }>;
		didDrag: boolean;
	} | null>(null);

	useEffect(() => {
		setJsonError(null);
		methods.reset(initial);
		setSelectedOpId(null);
		setSelectedNodeIds([]);
		const metaGroups = readNodeEditorMeta(profile.meta)?.groups ?? {};
		setGroups(metaGroups);
		setSelectedGroupId(null);
		setGroupEditor(null);
		setIsLayoutDirty(false);
	}, [initial, profile.meta]);

	const nodeTypes = useMemo(() => ({ operation: OperationFlowNode }), []);

	const areStringArraysEqual = useCallback((a: string[], b: string[]) => {
		if (a === b) return true;
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
		return true;
	}, []);

	const safeOperations = Array.isArray(operations) ? operations : [];
	const opIndexById = useMemo(() => new Map(safeOperations.map((op, idx) => [op.opId, idx])), [safeOperations]);

	const edges = useMemo(() => buildEdges(safeOperations), [safeOperations]);

	const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node<OperationFlowNodeData>>([]);
	useEffect(() => {
		nodesRef.current = nodes;
	}, [nodes]);

	// Initialize nodes on open / profile change.
	useEffect(() => {
		if (!opened) return;
		const meta = readNodeEditorMeta(profile.meta);
		const fallbackPositions = computeSimpleLayout(extractOpIds(methods.getValues()), edgesToDeps(edges));
		const initialNodes: Array<Node<OperationFlowNodeData>> = safeOperations.map((op) => {
			const pos = meta?.nodes?.[op.opId] ?? fallbackPositions[op.opId] ?? { x: 0, y: 0 };
			return {
				id: op.opId,
				type: 'operation',
				position: pos,
				zIndex: 100,
				data: {
					opId: op.opId,
					name: op.name,
					description: op.description,
					kind: op.kind,
					isEnabled: Boolean(op.config.enabled),
					isRequired: Boolean(op.config.required),
				},
			};
		});
		setNodes(initialNodes);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [opened, profile.profileId]);

	// Keep node data in sync with form, but preserve positions while dragging.
	useEffect(() => {
		if (!opened) return;
		setNodes((prev) => {
			const prevById = new Map(prev.map((n) => [String(n.id), n]));
			const fallbackPositions = computeSimpleLayout(extractOpIds(methods.getValues()), edgesToDeps(edges));

			const next = safeOperations.map((op) => {
				const existing = prevById.get(op.opId);
				const nextData: OperationFlowNodeData = {
					opId: op.opId,
					name: op.name,
					description: op.description,
					kind: op.kind,
					isEnabled: Boolean(op.config.enabled),
					isRequired: Boolean(op.config.required),
				};

				// Important: preserve measured/width/height/etc that ReactFlow stores in node state.
				// Otherwise ReactFlow will keep re-measuring and emitting node changes, which can cause
				// mount-time update loops ("Maximum update depth exceeded").
				return {
					...(existing ?? {}),
					id: op.opId,
					type: 'operation',
					position: existing?.position ?? fallbackPositions[op.opId] ?? { x: 0, y: 0 },
					zIndex: existing?.zIndex ?? 100,
					data: nextData,
				} satisfies Node<OperationFlowNodeData>;
			});

			// Avoid pointless state updates (helps prevent feedback loops).
			if (prev.length === next.length) {
				let same = true;
				for (let i = 0; i < next.length; i++) {
					const a = prev[i];
					const b = next[i];
					if (!a || !b) {
						same = false;
						break;
					}
					const ad = a.data as any;
					const bd = b.data as any;
					if (String(a.id) !== String(b.id)) {
						same = false;
						break;
					}
					if ((a.type ?? '') !== (b.type ?? '')) {
						same = false;
						break;
					}
					if ((a.position?.x ?? 0) !== (b.position?.x ?? 0) || (a.position?.y ?? 0) !== (b.position?.y ?? 0)) {
						same = false;
						break;
					}
					if (
						(ad?.opId ?? '') !== (bd?.opId ?? '') ||
						(ad?.name ?? '') !== (bd?.name ?? '') ||
						(ad?.description ?? '') !== (bd?.description ?? '') ||
						(ad?.kind ?? '') !== (bd?.kind ?? '') ||
						Boolean(ad?.isEnabled) !== Boolean(bd?.isEnabled) ||
						Boolean(ad?.isRequired) !== Boolean(bd?.isRequired)
					) {
						same = false;
						break;
					}
				}
				if (same) return prev;
			}

			return next;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [opened, safeOperations, edges]);

	const selectedIndex = selectedOpId ? (opIndexById.get(selectedOpId) ?? null) : null;
	const isDirty = formState.isDirty || isLayoutDirty;

	const onSave = methods.handleSubmit((values) => {
		setJsonError(null);
		try {
			const payload = fromOperationProfileForm(values, { validateJson: true });
			const nodesMap: Record<string, { x: number; y: number }> = {};
			for (const n of nodes) {
				nodesMap[String(n.id)] = { x: n.position.x, y: n.position.y };
			}
			const allowedIds = new Set(extractOpIds(values));
			const groupsToSave: Record<string, { name: string; nodeIds: string[]; bg?: string }> = {};
			for (const [groupId, g] of Object.entries(groups)) {
				const name = (g?.name ?? '').trim();
				const nodeIds = Array.isArray(g?.nodeIds) ? g.nodeIds.filter((id) => allowedIds.has(id)) : [];
				if (!groupId || !name || nodeIds.length === 0) continue;
				const bg = typeof g?.bg === 'string' && g.bg.trim() ? g.bg.trim() : undefined;
				groupsToSave[groupId] = { name, nodeIds: [...new Set(nodeIds)], bg };
			}
			const nodeEditorMeta = {
				version: 1 as const,
				nodes: nodesMap,
				groups: Object.keys(groupsToSave).length ? groupsToSave : undefined,
			};
			doUpdate({
				profileId: profile.profileId,
				patch: { ...payload, meta: writeNodeEditorMeta(profile.meta, nodeEditorMeta) },
			});
			setIsLayoutDirty(false);
		} catch (e) {
			setJsonError(e instanceof Error ? e.message : String(e));
		}
	});

	const addOperation = () => {
		const next = makeDefaultOperation();
		append(next);

		let position = { x: 0, y: safeOperations.length * 160 };
		if (flow && flowWrapperRef.current) {
			const r = flowWrapperRef.current.getBoundingClientRect();
			const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
			const p = (flow as any).screenToFlowPosition ? (flow as any).screenToFlowPosition(center) : null;
			if (p && typeof p.x === 'number' && typeof p.y === 'number') position = { x: p.x, y: p.y };
		}
		setNodes((prev) => [
			...prev,
			{
				id: next.opId,
				type: 'operation',
				position,
				zIndex: 100,
				data: {
					opId: next.opId,
					name: next.name,
					description: next.description,
					kind: next.kind,
					isEnabled: true,
					isRequired: false,
				},
			},
		]);
		setIsLayoutDirty(true);
		setSelectedOpId(next.opId);
	};

	const deleteSelectedNodes = useCallback(() => {
		const ids = selectedNodeIds.length ? selectedNodeIds : selectedOpId ? [selectedOpId] : [];
		if (ids.length === 0) return;

		// Remove operations + cleanup dependsOn everywhere.
		let current = methods.getValues();
		for (const removedOpId of ids) {
			current = removeOpIdFromAllDependsOn(current, removedOpId);
		}
		const nextOps = current.operations.filter((op) => !ids.includes(op.opId));
		replace(nextOps);

		setNodes((prev) => prev.filter((n) => !ids.includes(String(n.id))));
		setIsLayoutDirty(true);

		setSelectedNodeIds((prev) => prev.filter((id) => !ids.includes(id)));
		setSelectedOpId((prev) => (prev && ids.includes(prev) ? null : prev));
	}, [methods, replace, selectedNodeIds, selectedOpId, setNodes]);

	// Keyboard delete (Delete / Backspace) — but do not interfere with typing in inputs.
	useEffect(() => {
		if (!opened) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.defaultPrevented) return;
			if (isTextEditingTarget(e.target)) return;
			if (e.key !== 'Delete' && e.key !== 'Backspace') return;
			deleteSelectedNodes();
			e.preventDefault();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [opened, deleteSelectedNodes]);

	const createGroupFromSelection = useCallback(() => {
		const ids = [...new Set(selectedNodeIds)].filter(Boolean);
		if (ids.length < 2) return;
		const suggestedName = `Group ${Object.keys(groups).length + 1}`;
		const name = window.prompt('Group name', suggestedName);
		if (!name || !name.trim()) return;
		const groupId = uuidv4();
		setGroups((prev) => ({ ...prev, [groupId]: { name: name.trim(), nodeIds: ids } }));
		setSelectedGroupId(groupId);
		setIsLayoutDirty(true);
	}, [groups, selectedNodeIds]);

	const ungroupSelected = useCallback(() => {
		if (!selectedGroupId) return;
		setGroups((prev) => {
			if (!prev[selectedGroupId]) return prev;
			const { [selectedGroupId]: _removed, ...rest } = prev;
			return rest;
		});
		setSelectedGroupId(null);
		setGroupEditor((prev) => (prev?.groupId === selectedGroupId ? null : prev));
		setIsLayoutDirty(true);
	}, [selectedGroupId]);

	const groupSelectData = useMemo(
		() => Object.entries(groups).map(([value, g]) => ({ value, label: g.name })),
		[groups],
	);

	const computeGroupBounds = useCallback(
		(nodeIds: string[]) => {
			const ids = new Set(nodeIds);
			const live = (flow?.getNodes?.() ?? []).filter((n: any) => ids.has(String(n.id)));
			const liveBounds = computeBoundsFromNodes(live);
			if (liveBounds) return liveBounds;

			// Fallback to known node positions (fixed size approximations).
			const fallback = nodes
				.filter((n) => ids.has(String(n.id)))
				.map((n) => ({ ...n, width: 260, height: 140 }));
			return computeBoundsFromNodes(fallback);
		},
		[flow, nodes],
	);

	const openGroupEditor = useCallback(
		(groupId: string) => {
			const g = groups[groupId];
			if (!g) return;
			setSelectedGroupId(groupId);
			setGroupEditor({
				groupId,
				name: (g.name ?? '').trim(),
				bg: typeof g.bg === 'string' ? g.bg : '',
			});
		},
		[groups],
	);

	const startGroupLabelDrag = useCallback(
		(e: React.PointerEvent, groupId: string) => {
			// Always select group on pointer down.
			setSelectedGroupId(groupId);

			if (!flow || !(flow as any).screenToFlowPosition) {
				groupLabelDragRef.current = null;
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

			const startFlow = (flow as any).screenToFlowPosition({ x: e.clientX, y: e.clientY }) as { x: number; y: number };
			groupLabelDragRef.current = {
				groupId,
				pointerId: e.pointerId,
				startClient: { x: e.clientX, y: e.clientY },
				startFlow,
				startPositions,
				didDrag: false,
			};

			// Capture pointer to keep receiving move/up.
			try {
				e.currentTarget.setPointerCapture(e.pointerId);
			} catch {
				// ignore
			}

			e.preventDefault();
			e.stopPropagation();
		},
		[flow, groups],
	);

	const moveGroupLabelDrag = useCallback(
		(e: React.PointerEvent) => {
			const drag = groupLabelDragRef.current;
			if (!drag) return;
			if (drag.pointerId !== e.pointerId) return;
			if (!flow || !(flow as any).screenToFlowPosition) return;

			const dx = e.clientX - drag.startClient.x;
			const dy = e.clientY - drag.startClient.y;
			const threshold = 4;
			if (!drag.didDrag && Math.hypot(dx, dy) >= threshold) drag.didDrag = true;

			if (!drag.didDrag) {
				e.preventDefault();
				e.stopPropagation();
				return;
			}

			const curFlow = (flow as any).screenToFlowPosition({ x: e.clientX, y: e.clientY }) as { x: number; y: number };
			const delta = { x: curFlow.x - drag.startFlow.x, y: curFlow.y - drag.startFlow.y };

			setNodes((prev) =>
				prev.map((n) => {
					const id = String(n.id);
					const start = drag.startPositions[id];
					if (!start) return n;
					return { ...n, position: { x: start.x + delta.x, y: start.y + delta.y } };
				}),
			);
			setIsLayoutDirty(true);

			e.preventDefault();
			e.stopPropagation();
		},
		[flow, setNodes],
	);

	const endGroupLabelDrag = useCallback(
		(e: React.PointerEvent, groupId: string) => {
			const drag = groupLabelDragRef.current;
			groupLabelDragRef.current = null;
			if (!drag || drag.pointerId !== e.pointerId) {
				return;
			}

			try {
				e.currentTarget.releasePointerCapture(e.pointerId);
			} catch {
				// ignore
			}

			// If it wasn't a drag, treat as click -> open editor.
			if (!drag.didDrag) openGroupEditor(groupId);

			e.preventDefault();
			e.stopPropagation();
		},
		[openGroupEditor],
	);

	// Keep groups consistent when nodes are removed.
	useEffect(() => {
		// Important: avoid pruning while nodes are still initializing (prevents mount-time loops).
		if (nodes.length === 0) return;

		const existing = new Set(nodes.map((n) => String(n.id)));

		setGroups((prev) => {
			const pruned: Record<string, EditorGroup> = {};
			for (const [groupId, g] of Object.entries(prev)) {
				const name = (g?.name ?? '').trim();
				const nodeIds = Array.isArray(g?.nodeIds) ? g.nodeIds.filter((id) => existing.has(id)) : [];
				if (!groupId || !name || nodeIds.length === 0) continue;
				const bg = typeof g?.bg === 'string' && g.bg.trim() ? g.bg.trim() : undefined;
				pruned[groupId] = { name, nodeIds: [...new Set(nodeIds)], bg };
			}

			const sameKeys = Object.keys(pruned).length === Object.keys(prev).length && Object.keys(pruned).every((k) => prev[k]);
			const sameContent =
				sameKeys &&
				Object.entries(pruned).every(([k, v]) => {
					const g = prev[k];
					if (!g) return false;
					if ((g.name ?? '').trim() !== v.name) return false;
					const a = [...new Set(g.nodeIds ?? [])].slice().sort();
					const b = [...new Set(v.nodeIds ?? [])].slice().sort();
					return a.length === b.length && a.every((id, idx) => id === b[idx]);
				});

			if (sameContent) return prev;
			setIsLayoutDirty(true);
			return pruned;
		});
	}, [nodes]);

	// If selected group disappeared, clear selection.
	useEffect(() => {
		if (!selectedGroupId) return;
		if (!groups[selectedGroupId]) setSelectedGroupId(null);
	}, [groups, selectedGroupId]);

	// If opened group editor group disappeared, close editor.
	useEffect(() => {
		if (!groupEditor) return;
		if (!groups[groupEditor.groupId]) setGroupEditor(null);
	}, [groupEditor, groups]);

	const onConnect = (conn: Connection) => {
		didConnectRef.current = true;
		if (!conn.source || !conn.target) return;
		if (conn.source === conn.target) return;
		const targetIdx = opIndexById.get(conn.target);
		if (targetIdx === undefined) return;

		const path = `operations.${targetIdx}.config.dependsOn` as const;
		const current = (methods.getValues(path) ?? []) as string[];
		if (current.includes(conn.source)) return;
		setValue(path, [...current, conn.source], { shouldDirty: true });
	};

	const onConnectStart = (_: unknown, params: { nodeId?: string | null; handleType?: 'source' | 'target' | null }) => {
		didConnectRef.current = false;
		connectingSourceIdRef.current = params.handleType === 'source' && params.nodeId ? String(params.nodeId) : null;
	};

	const onConnectEnd = (event: MouseEvent | TouchEvent) => {
		const sourceId = connectingSourceIdRef.current;
		connectingSourceIdRef.current = null;

		if (!sourceId) return;
		if (didConnectRef.current) return;
		if (!flow) return;

		const target = event.target as HTMLElement | null;
		const isPane = Boolean(target?.closest?.('.react-flow__pane'));
		if (!isPane) return;

		const p =
			'touches' in event && event.touches?.[0]
				? { x: event.touches[0].clientX, y: event.touches[0].clientY }
				: 'changedTouches' in event && event.changedTouches?.[0]
					? { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY }
					: 'clientX' in event && typeof event.clientX === 'number' && typeof event.clientY === 'number'
						? { x: event.clientX, y: event.clientY }
						: null;
		if (!p) return;

		// Create new operation at drop position and connect source -> new (new.dependsOn=[source]).
		const pos = (flow as any).screenToFlowPosition ? (flow as any).screenToFlowPosition(p) : null;
		if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number') return;

		const next = makeDefaultOperation();
		next.config.dependsOn = [sourceId];
		append(next);

		setNodes((prev) => [
			...prev,
			{
				id: next.opId,
				type: 'operation',
				position: { x: pos.x, y: pos.y },
				zIndex: 100,
				data: {
					opId: next.opId,
					name: next.name,
					description: next.description,
					kind: next.kind,
					isEnabled: Boolean(next.config.enabled),
					isRequired: Boolean(next.config.required),
				},
			},
		]);
		setSelectedOpId(next.opId);
		setIsLayoutDirty(true);
	};

	const onEdgesChange = (changes: EdgeChange[]) => {
		const removed = changes.filter((c) => c.type === 'remove').map((c) => c.id);
		if (removed.length === 0) return;

		for (const id of removed) {
			const [source, target] = String(id).split('=>');
			if (!source || !target) continue;
			const targetIdx = opIndexById.get(target);
			if (targetIdx === undefined) continue;
			const path = `operations.${targetIdx}.config.dependsOn` as const;
			const current = (methods.getValues(path) ?? []) as string[];
			if (!current.includes(source)) continue;
			setValue(
				path,
				current.filter((v) => v !== source),
				{ shouldDirty: true },
			);
		}
	};

	const onNodesChange = (changes: NodeChange[]) => {
		onNodesChangeBase(changes as any);
		if (changes.some((c) => c.type === 'position')) setIsLayoutDirty(true);
	};

	const onSelectionChange = useCallback(
		({ nodes: selectedNodes }: { nodes: Array<{ id: string | number }> }) => {
			const ids = selectedNodes.map((n) => String(n.id));
			setSelectedNodeIds((prev) => (areStringArraysEqual(prev, ids) ? prev : ids));
		},
		[areStringArraysEqual],
	);

	const onNodeClick = useCallback((_: unknown, node: Node) => {
		setSelectedOpId(String(node.id));
	}, []);

	const onPaneClick = useCallback(() => {
		setSelectedOpId(null);
		setSelectedNodeIds((prev) => (prev.length === 0 ? prev : []));
	}, []);

	const onNodeDragStop = (_: unknown, node: Node) => {
		setNodes((prev) => prev.map((n) => (String(n.id) === String(node.id) ? { ...n, position: node.position } : n)));
		setIsLayoutDirty(true);
	};

	const autoLayout = () => {
		const opIds = extractOpIds(methods.getValues());
		const deps = edgesToDeps(edges);
		const positions = computeSimpleLayout(opIds, deps);
		setNodes((prev) =>
			prev.map((n) => {
				const pos = positions[String(n.id)];
				return pos ? { ...n, position: pos } : n;
			}),
		);
		setIsLayoutDirty(true);
	};

	return (
		<Modal
			opened={opened}
			onClose={onClose}
			fullScreen
			withCloseButton={false}
			zIndex={4000}
			padding={0}
			styles={{
				content: { height: '100dvh' },
				body: { height: '100dvh', padding: 16, display: 'flex', flexDirection: 'column' },
			}}
		>
			<FormProvider {...methods}>
				<Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
					<style>
						{`
              /* Ensure group overlays stay behind edges and nodes */
              .op-profile-node-editor-flow .react-flow__viewport-portal { z-index: 1; }
              .op-profile-node-editor-flow .react-flow__edges { z-index: 2; }
              .op-profile-node-editor-flow .react-flow__nodes { z-index: 3; }
            `}
					</style>
					<Group justify="space-between" wrap="nowrap">
						<Stack gap={2}>
							<Text fw={800} size="lg">
								Node editor — {profile.name}
							</Text>
							<Text size="sm" c="dimmed">
								Ноды — операции, связи — dependsOn. Клик по ноде открывает редактор справа.
							</Text>
						</Stack>

						<Group gap="xs" wrap="nowrap">
							<Button variant="light" leftSection={<LuLayoutDashboard />} onClick={autoLayout}>
								Auto layout
							</Button>
							<Button leftSection={<LuSave />} disabled={!isDirty} onClick={onSave}>
								Save
							</Button>
							<Button variant="default" leftSection={<LuX />} onClick={onClose}>
								Close
							</Button>
						</Group>
					</Group>

					{jsonError && (
						<Alert color="red" title="JSON error">
							{jsonError}
						</Alert>
					)}

					<Divider />

					<Group gap={0} wrap="nowrap" align="stretch" style={{ flex: 1, minHeight: 0 }}>
						<div ref={flowWrapperRef} className="op-profile-node-editor-flow" style={{ flex: 1, minHeight: 0 }}>
							<ReactFlowProvider>
								<ReactFlow
									nodes={nodes}
									edges={edges}
									nodeTypes={nodeTypes}
									connectionLineType={ConnectionLineType.SmoothStep}
									onInit={setFlow}
									onConnect={onConnect}
									onConnectStart={onConnectStart}
									onConnectEnd={onConnectEnd}
									onEdgesChange={onEdgesChange}
									onNodesChange={onNodesChange}
									onNodeDragStop={onNodeDragStop}
									selectionOnDrag
									selectionKeyCode={['Shift']}
									multiSelectionKeyCode={['Control', 'Meta', 'Shift']}
									deleteKeyCode={null}
									onSelectionChange={onSelectionChange as any}
									onNodeClick={onNodeClick}
									onPaneClick={onPaneClick}
								>
									<Background />
									<Controls />
									<ViewportPortal>
										{Object.entries(groups).map(([groupId, g]) => {
											const bounds = computeGroupBounds(g.nodeIds);
											if (!bounds) return null;

											const pad = 24;
											const badgeH = 26;
											const gap = 8;
											const isActive = selectedGroupId === groupId;
											const colors = getGroupColors(g.bg);

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
															border: isActive ? '2px solid rgba(76,110,245,0.85)' : '2px dashed rgba(0,0,0,0.25)',
															background: colors.bg,
															pointerEvents: 'none',
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
															style={{ cursor: 'pointer', userSelect: 'none', background: colors.base }}
															onPointerDown={(e) => startGroupLabelDrag(e, groupId)}
															onPointerMove={(e) => moveGroupLabelDrag(e)}
															onPointerUp={(e) => endGroupLabelDrag(e, groupId)}
														>
															{g.name}
														</Badge>
													</div>
												</div>
											);
										})}
									</ViewportPortal>
									<Panel position="top-left">
										<Stack gap={6}>
											<Group gap="xs" wrap="nowrap">
												<Button size="xs" leftSection={<LuPlus />} onClick={addOperation}>
													Add
												</Button>
												<Button
													size="xs"
													color="red"
													variant="light"
													leftSection={<LuTrash2 />}
													disabled={selectedNodeIds.length === 0 && !selectedOpId}
													onClick={deleteSelectedNodes}
												>
													Delete
												</Button>
												<Button size="xs" variant="light" disabled={selectedNodeIds.length < 2} onClick={createGroupFromSelection}>
													Group
												</Button>
											</Group>

											<Group gap="xs" wrap="nowrap">
												<Select
													size="xs"
													placeholder="Groups"
													data={groupSelectData}
													value={selectedGroupId ?? ''}
													onChange={(v) => setSelectedGroupId(v && v !== '' ? v : null)}
													comboboxProps={{ withinPortal: false }}
													style={{ minWidth: 200 }}
												/>
												<Button size="xs" variant="default" disabled={!selectedGroupId} onClick={ungroupSelected}>
													Ungroup
												</Button>
											</Group>
										</Stack>
									</Panel>
								</ReactFlow>
							</ReactFlowProvider>
						</div>

						<Divider orientation="vertical" />

						<ScrollArea style={{ width: 480, height: '100%' }} p="md">
							<Stack gap="md">
								<Group justify="space-between" wrap="nowrap">
									<Text fw={800}>Operation</Text>
									<Text size="xs" c="dimmed">
										{selectedIndex === null ? '—' : `#${selectedIndex + 1}`}
									</Text>
								</Group>

								{selectedIndex === null ? (
									<Text size="sm" c="dimmed">
										Выберите ноду, чтобы редактировать операцию.
									</Text>
								) : (
									<OperationEditor
										key={selectedOpId ?? String(selectedIndex)}
										index={selectedIndex}
										onRemove={() => deleteSelectedNodes()}
									/>
								)}
							</Stack>
						</ScrollArea>
					</Group>
				</Stack>

				<Modal
					opened={Boolean(groupEditor)}
					onClose={() => setGroupEditor(null)}
					title="Edit group"
					centered
					zIndex={5000}
				>
					{groupEditor && (
						<Stack gap="sm">
							<TextInput
								label="Name"
								value={groupEditor.name}
								onChange={(e) => {
									const value = e.currentTarget.value;
									setGroupEditor((prev) => (prev ? { ...prev, name: value } : prev));
								}}
								placeholder="Group name"
								autoFocus
							/>

							<div>
								<Text size="sm" fw={600} style={{ marginBottom: 6 }}>
									Background
								</Text>
								<Group gap="xs" wrap="nowrap">
									<input
										type="color"
										value={(() => {
											const rgb = parseCssColorToRgb(groupEditor.bg?.trim() ? groupEditor.bg : DEFAULT_GROUP_COLOR);
											if (!rgb) return DEFAULT_GROUP_COLOR;
											const toHex = (n: number) => n.toString(16).padStart(2, '0');
											return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
										})()}
										onChange={(e) => {
											const value = e.currentTarget.value;
											setGroupEditor((prev) => (prev ? { ...prev, bg: value } : prev));
										}}
										style={{ width: 44, height: 34, padding: 0, border: '1px solid rgba(0,0,0,0.2)', borderRadius: 8 }}
									/>
									<TextInput
										style={{ flex: 1 }}
										value={groupEditor.bg}
										onChange={(e) => {
											const value = e.currentTarget.value;
											setGroupEditor((prev) => (prev ? { ...prev, bg: value } : prev));
										}}
										placeholder="CSS color (alpha will be ignored)"
									/>
								</Group>
								<Text size="xs" c="dimmed" style={{ marginTop: 6 }}>
									Transparency is fixed to match default groups; your input controls only the base color.
								</Text>
							</div>

							<Group justify="space-between" wrap="nowrap" mt="xs">
								<Button
									color="red"
									variant="light"
									onClick={() => {
										const id = groupEditor.groupId;
										setGroups((prev) => {
											if (!prev[id]) return prev;
											const { [id]: _removed, ...rest } = prev;
											return rest;
										});
										setSelectedGroupId((prev) => (prev === id ? null : prev));
										setIsLayoutDirty(true);
										setGroupEditor(null);
									}}
								>
									Delete group
								</Button>

								<Group gap="xs" wrap="nowrap">
									<Button variant="default" onClick={() => setGroupEditor(null)}>
										Cancel
									</Button>
									<Button
										onClick={() => {
											const id = groupEditor.groupId;
											const name = groupEditor.name.trim();
											const bgRaw = groupEditor.bg.trim();
											if (!name) return;

											// Store an opaque base color; alpha is applied at render time.
											const rgb = parseCssColorToRgb(bgRaw) ?? parseCssColorToRgb(DEFAULT_GROUP_COLOR) ?? { r: 76, g: 110, b: 245 };
											const bg = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

											setGroups((prev) => {
												const g = prev[id];
												if (!g) return prev;
												return { ...prev, [id]: { ...g, name, bg: bgRaw ? bg : undefined } };
											});
											setIsLayoutDirty(true);
											setGroupEditor(null);
										}}
									>
										Save
									</Button>
								</Group>
							</Group>
						</Stack>
					)}
				</Modal>
			</FormProvider>
		</Modal>
	);
};

