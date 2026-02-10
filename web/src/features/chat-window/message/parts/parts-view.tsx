import { Box, Collapse, Group, Paper, Stack, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { $appDebugEnabled } from '@model/app-debug';

import { getUiProjection } from './projection';
import { renderPart } from './renderers';

import type { Entry, Part, Variant } from '@shared/types/chat-entry-parts';

type Props = {
	entry: Entry;
	variant: Variant | null;
	currentTurn: number;
};

export const PartsView: React.FC<Props> = ({ entry, variant, currentTurn }) => {
	const { t } = useTranslation();
	const appDebugEnabled = useUnit($appDebugEnabled);
	const [debugUiEnabled, setDebugUiEnabled] = useState(false);
	const [inspectorOpen, setInspectorOpen] = useState(false);

	const visible = getUiProjection(entry, variant, {
		currentTurn,
		debugEnabled: appDebugEnabled && debugUiEnabled,
	});
	const allParts = variant?.parts ?? [];

	useEffect(() => {
		if (appDebugEnabled) return;
		setDebugUiEnabled(false);
		setInspectorOpen(false);
	}, [appDebugEnabled]);

	const renderList = (parts: Part[]) => {
		return (
			<Stack gap="xs">
				{parts.map((p) => (
					<Box key={p.partId}>{renderPart(p)}</Box>
				))}
			</Stack>
		);
	};

	if (!appDebugEnabled) {
		return <>{renderList(visible)}</>;
	}

	return (
		<Stack gap="sm">
			{renderList(visible)}

			<Group gap="xs" justify="flex-end">
				<Text size="xs" c="dimmed" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setDebugUiEnabled((v) => !v)}>
					{t('chat.debug.debugUi')}: {debugUiEnabled ? t('chat.debug.on') : t('chat.debug.off')}
				</Text>
				<Text size="xs" c="dimmed" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setInspectorOpen((v) => !v)}>
					{t('chat.debug.inspector')}: {inspectorOpen ? t('chat.debug.hide') : t('chat.debug.show')}
				</Text>
			</Group>

			<Collapse in={inspectorOpen}>
				<Paper withBorder radius="md" p="sm">
					<Text size="xs" fw={600} mb="xs">
						{t('chat.debug.rawParts')}
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
