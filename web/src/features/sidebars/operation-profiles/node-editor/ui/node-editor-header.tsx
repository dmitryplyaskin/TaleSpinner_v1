import { Badge, Button, Group, Stack, Text } from '@mantine/core';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuLayoutDashboard, LuPanelRightClose, LuPanelRightOpen, LuSave, LuX } from 'react-icons/lu';

type Props = {
	profileName: string;
	isDirty: boolean;
	onAutoLayout: () => void;
	onSave: () => void;
	onClose: () => void;
	isInspectorVisible?: boolean;
	onToggleInspector?: () => void;
	showInspectorToggle?: boolean;
};

export const NodeEditorHeader: React.FC<Props> = ({
	profileName,
	isDirty,
	onAutoLayout,
	onSave,
	onClose,
	isInspectorVisible,
	onToggleInspector,
	showInspectorToggle = false,
}) => {
	const { t } = useTranslation();
	return (
		<Group justify="space-between" wrap="wrap" className="opNodeHeader">
			<Stack gap={2}>
				<Group gap="xs" wrap="wrap">
					<Text fw={800} size="lg">
						{t('operationProfiles.nodeEditor.title')}
					</Text>
					<Badge variant="light">{profileName}</Badge>
					{isDirty && <Badge color="yellow">{t('operationProfiles.operationEditor.unsaved')}</Badge>}
				</Group>
				<Text size="sm" c="dimmed">
					{t('operationProfiles.nodeEditor.subtitle')}
				</Text>
			</Stack>

			<Group gap="xs" wrap="nowrap">
				{showInspectorToggle && (
					<Button variant="default" leftSection={isInspectorVisible ? <LuPanelRightClose /> : <LuPanelRightOpen />} onClick={onToggleInspector}>
						{isInspectorVisible ? t('operationProfiles.nodeEditor.hideOperation') : t('operationProfiles.nodeEditor.showOperation')}
					</Button>
				)}
				<Button variant="light" leftSection={<LuLayoutDashboard />} onClick={onAutoLayout}>
					{t('operationProfiles.nodeEditor.autoLayout')}
				</Button>
				<Button leftSection={<LuSave />} disabled={!isDirty} onClick={onSave}>
					{t('common.save')}
				</Button>
				<Button variant="default" leftSection={<LuX />} onClick={onClose}>
					{t('common.close')}
				</Button>
			</Group>
		</Group>
	);
};
