import { Button, Stack, Text } from '@mantine/core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowLeft, LuPlus, LuWorkflow } from 'react-icons/lu';

import { OperationList } from './operation-list';
import { getOperationListLayout } from './operation-list-layout';

import type { OperationWorkspaceMode } from './operation-workspace-mode';
import type { OperationListRowMeta } from './types';

type Props = {
	mode: OperationWorkspaceMode;
	rows: OperationListRowMeta[];
	selectedOpId: string | null;
	selectedIndex: number | null;
	inspectorContent: React.ReactNode;
	onAdd: () => void;
	onMoveSelection: (direction: 'prev' | 'next') => void;
	onSelect: (opId: string) => void;
	onBackToList: () => void;
};

export const OperationWorkspace: React.FC<Props> = ({
	mode,
	rows,
	selectedOpId,
	selectedIndex,
	inspectorContent,
	onAdd,
	onMoveSelection,
	onSelect,
	onBackToList,
}) => {
	const { t } = useTranslation();
	const listLayout = getOperationListLayout(mode === 'split');
	const list = (
		<OperationList
			rows={rows}
			selectedOpId={selectedOpId}
			onQuickAdd={onAdd}
			onMoveSelection={onMoveSelection}
			onSelect={onSelect}
			onFocusEditor={selectedOpId ? () => onSelect(selectedOpId) : undefined}
			className={listLayout.listClassName}
			scrollAreaClassName={listLayout.scrollAreaClassName}
		/>
	);

	if (rows.length === 0) {
		return (
			<section className="op-emptyState">
				<LuWorkflow size={28} aria-hidden />
				<Stack gap={4} align="center">
					<Text fw={650}>{t('operationProfiles.operations.emptyTitle')}</Text>
					<Text size="sm" c="dimmed" ta="center">
						{t('operationProfiles.operations.empty')}
					</Text>
				</Stack>
				<Button leftSection={<LuPlus />} onClick={onAdd}>
					{t('operationProfiles.actions.addOperation')}
				</Button>
			</section>
		);
	}

	if (mode === 'split') {
		return (
			<div className="op-workspace">
				<aside className={listLayout.paneClassName}>{list}</aside>
				<section className="op-inspectorPane">
					<header className="op-inspectorHeader">
						<Text fw={700}>{t('operationProfiles.inspector.title')}</Text>
						<Text className="op-listHint">
							{selectedIndex === null
								? t('operationProfiles.inspector.noneSelected')
								: t('operationProfiles.inspector.operationNumber', { number: selectedIndex + 1 })}
						</Text>
					</header>
					<div className="op-inspectorScroll">{inspectorContent}</div>
				</section>
			</div>
		);
	}

	if (mode === 'list') {
		return <section className="op-compactScreen op-compactList">{list}</section>;
	}

	return (
		<section className="op-compactScreen op-compactInspector">
			<header className="op-compactNav">
				<Button variant="subtle" size="compact-sm" leftSection={<LuArrowLeft />} onClick={onBackToList}>
					{t('operationProfiles.inspector.backToOperations')}
				</Button>
				<Text size="xs" c="dimmed">
					{selectedIndex === null ? null : t('operationProfiles.inspector.operationNumber', { number: selectedIndex + 1 })}
				</Text>
			</header>
			<div className="op-compactInspectorBody">{inspectorContent}</div>
		</section>
	);
};
