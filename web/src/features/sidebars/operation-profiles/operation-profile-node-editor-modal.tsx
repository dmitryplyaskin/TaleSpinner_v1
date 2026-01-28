import '@xyflow/react/dist/style.css';

import { Alert, Button, Divider, Group, Modal, ScrollArea, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { LuLayoutDashboard, LuPlus, LuSave, LuTrash2, LuX } from 'react-icons/lu';

import type { OperationProfileDto } from '../../../api/chat-core';

import { updateOperationProfileFx } from '@model/operation-profiles';
import {
	Background,
	ConnectionLineType,
	Controls,
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

import { OperationDepsOptionsProvider } from './operation-deps-options';
import { OperationItem } from './operation-item';
import { fromOperationProfileForm, makeDefaultOperation, toOperationProfileForm, type OperationProfileFormValues } from './operation-profile-form';
import { OperationFlowNode, type OperationFlowNodeData } from './operation-profile-flow-nodes';
import { computeSimpleLayout, readNodeEditorMeta, writeNodeEditorMeta } from './operation-profile-node-editor-meta';

type Props = {
	opened: boolean;
	onClose: () => void;
	profile: OperationProfileDto;
};

type OpEdge = { source: string; target: string };

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

export const OperationProfileNodeEditorModal: React.FC<Props> = ({ opened, onClose, profile }) => {
	const doUpdate = useUnit(updateOperationProfileFx);

	const initial = useMemo(() => toOperationProfileForm(profile), [profile]);
	const methods = useForm<OperationProfileFormValues>({ defaultValues: initial });
	const { control, formState, setValue } = methods;

	const { fields, append, replace } = useFieldArray({ name: 'operations', control, keyName: '_key' });
	const operations = useWatch({ control, name: 'operations' }) as OperationProfileFormValues['operations'] | undefined;

	const [selectedOpId, setSelectedOpId] = useState<string | null>(null);
	const [depsKey, setDepsKey] = useState(0);
	const [jsonError, setJsonError] = useState<string | null>(null);
	const [isLayoutDirty, setIsLayoutDirty] = useState(false);
	const [flow, setFlow] = useState<ReactFlowInstance | null>(null);

	const connectingSourceIdRef = useRef<string | null>(null);
	const didConnectRef = useRef(false);

	useEffect(() => {
		setJsonError(null);
		methods.reset(initial);
		setSelectedOpId(null);
		setDepsKey((v) => v + 1);
		setIsLayoutDirty(false);
	}, [initial, profile.meta]);

	const nodeTypes = useMemo(() => ({ operation: OperationFlowNode }), []);

	const safeOperations = Array.isArray(operations) ? operations : [];
	const opIndexById = useMemo(() => new Map(safeOperations.map((op, idx) => [op.opId, idx])), [safeOperations]);

	const edges = useMemo(() => buildEdges(safeOperations), [safeOperations]);

	const [nodes, setNodes, onNodesChangeBase] = useNodesState<Node<OperationFlowNodeData>>([]);

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
		setNodes((prev) => {
			const prevById = new Map(prev.map((n) => [String(n.id), n]));
			const fallbackPositions = computeSimpleLayout(extractOpIds(methods.getValues()), edgesToDeps(edges));

			const next = safeOperations.map((op) => {
				const existing = prevById.get(op.opId);
				return {
					id: op.opId,
					type: 'operation',
					position: existing?.position ?? fallbackPositions[op.opId] ?? { x: 0, y: 0 },
					data: {
						opId: op.opId,
						name: op.name,
						description: op.description,
						kind: op.kind,
						isEnabled: Boolean(op.config.enabled),
						isRequired: Boolean(op.config.required),
					},
				} satisfies Node<OperationFlowNodeData>;
			});

			return next;
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [safeOperations, edges]);

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
			const nodeEditorMeta = { version: 1 as const, nodes: nodesMap };
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
		setDepsKey((v) => v + 1);

		const y = safeOperations.length * 160;
		setNodes((prev) => [
			...prev,
			{
				id: next.opId,
				type: 'operation',
				position: { x: 0, y },
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

	const deleteSelected = () => {
		if (!selectedOpId) return;
		const idx = opIndexById.get(selectedOpId);
		if (idx === undefined) return;

		// Remove op + cleanup dependsOn everywhere.
		const current = methods.getValues();
		const cleaned = removeOpIdFromAllDependsOn(current, selectedOpId);
		const nextOps = cleaned.operations.filter((op) => op.opId !== selectedOpId);
		replace(nextOps);
		setSelectedOpId(null);
		setDepsKey((v) => v + 1);
		setNodes((prev) => prev.filter((n) => String(n.id) !== selectedOpId));
		setIsLayoutDirty(true);
	};

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
		setDepsKey((v) => v + 1);
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
		setDepsKey((v) => v + 1);

		setNodes((prev) => [
			...prev,
			{
				id: next.opId,
				type: 'operation',
				position: { x: pos.x, y: pos.y },
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
		setDepsKey((v) => v + 1);
	};

	const onNodesChange = (changes: NodeChange[]) => {
		onNodesChangeBase(changes as any);
		if (changes.some((c) => c.type === 'position')) setIsLayoutDirty(true);
	};

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
						<div style={{ flex: 1, minHeight: 0 }}>
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
									onNodeClick={(_, node) => setSelectedOpId(String(node.id))}
									onPaneClick={() => setSelectedOpId(null)}
								>
									<Background />
									<Controls />
									<Panel position="top-left">
										<Group gap="xs" wrap="nowrap">
											<Button size="xs" leftSection={<LuPlus />} onClick={addOperation}>
												Add
											</Button>
											<Button
												size="xs"
												color="red"
												variant="light"
												leftSection={<LuTrash2 />}
												disabled={!selectedOpId}
												onClick={deleteSelected}
											>
												Delete
											</Button>
										</Group>
									</Panel>
								</ReactFlow>
							</ReactFlowProvider>
						</div>

						<Divider orientation="vertical" />

						<ScrollArea style={{ width: 480, height: '100%' }} p="md">
							<OperationDepsOptionsProvider>
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
										<OperationItem
											key={`${fields[selectedIndex]?._key ?? selectedOpId}-${depsKey}`}
											index={selectedIndex}
											depsKey={depsKey}
											onRemove={() => deleteSelected()}
										/>
									)}
								</Stack>
							</OperationDepsOptionsProvider>
						</ScrollArea>
					</Group>
				</Stack>
			</FormProvider>
		</Modal>
	);
};

