import { Box, Collapse, Group, Paper, Stack, Text } from '@mantine/core';
import { useState } from 'react';

import type { Entry, Part, Variant } from '@shared/types/chat-entry-parts';

import { getUiProjection } from './projection';
import { renderPart } from './renderers';

type Props = {
	entry: Entry;
	variant: Variant | null;
	currentTurn: number;
};

export const PartsView: React.FC<Props> = ({ entry, variant, currentTurn }) => {
	const [debugEnabled, setDebugEnabled] = useState(false);
	const [inspectorOpen, setInspectorOpen] = useState(false);

	const visible = getUiProjection(entry, variant, { currentTurn, debugEnabled });
	const allParts = variant?.parts ?? [];

	const renderList = (parts: Part[]) => {
		return (
			<Stack gap="xs">
				{parts.map((p) => (
					<Box key={p.partId}>{renderPart(p)}</Box>
				))}
			</Stack>
		);
	};

	return (
		<Stack gap="sm">
			{renderList(visible)}

			<Group gap="xs" justify="flex-end">
				<Text
					size="xs"
					c="dimmed"
					style={{ cursor: 'pointer', userSelect: 'none' }}
					onClick={() => setDebugEnabled((v) => !v)}
				>
					Debug UI: {debugEnabled ? 'on' : 'off'}
				</Text>
				<Text
					size="xs"
					c="dimmed"
					style={{ cursor: 'pointer', userSelect: 'none' }}
					onClick={() => setInspectorOpen((v) => !v)}
				>
					Inspector: {inspectorOpen ? 'hide' : 'show'}
				</Text>
			</Group>

			<Collapse in={inspectorOpen}>
				<Paper withBorder radius="md" p="sm">
					<Text size="xs" fw={600} mb="xs">
						Raw parts
					</Text>
					<Stack gap="xs">
						{allParts.map((p) => (
							<Box key={p.partId}>
								<Text size="xs" c="dimmed">
									{p.channel} order={p.order} id={p.partId} createdTurn={p.createdTurn}{' '}
									{typeof p.replacesPartId === 'string' ? `replaces=${p.replacesPartId}` : ''}
									{p.softDeleted ? ' softDeleted' : ''}
								</Text>
								<Box>{renderPart(p)}</Box>
							</Box>
						))}
					</Stack>
				</Paper>
			</Collapse>
		</Stack>
	);
};

