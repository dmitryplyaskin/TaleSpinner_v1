import { ActionIcon, Badge, Button, Group, Stack, Text, Tooltip } from '@mantine/core';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { FloppyDiskIcon, InfoIcon, SidebarSimpleIcon, TreeStructureIcon, XIcon } from '@ui/icons';
import { TOOLTIP_PORTAL_SETTINGS } from '@ui/z-index';

type Props = {
	profileName: string;
	isDirty: boolean;
	onAutoLayout: () => void | Promise<void>;
	isAutoLayouting: boolean;
	onSave: () => void;
	onClose: () => void;
	onOpenHelp: () => void;
	isInspectorVisible?: boolean;
	onToggleInspector?: () => void;
	showInspectorToggle?: boolean;
};

export const NodeEditorHeader: React.FC<Props> = ({
	profileName,
	isDirty,
	onAutoLayout,
	isAutoLayouting,
	onSave,
	onClose,
	onOpenHelp,
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
				<Tooltip label={t('operationProfiles.nodeEditor.help.open')} {...TOOLTIP_PORTAL_SETTINGS}>
					<ActionIcon variant="subtle" aria-label={t('operationProfiles.nodeEditor.help.open')} onClick={onOpenHelp}>
						<InfoIcon size={18} />
					</ActionIcon>
				</Tooltip>
				{showInspectorToggle && (
					<Button variant="default" leftSection={<SidebarSimpleIcon mirrored weight={isInspectorVisible ? 'fill' : 'regular'} />} onClick={onToggleInspector}>
						{isInspectorVisible ? t('operationProfiles.nodeEditor.hideOperation') : t('operationProfiles.nodeEditor.showOperation')}
					</Button>
				)}
				<Button variant="light" leftSection={<TreeStructureIcon />} loading={isAutoLayouting} onClick={onAutoLayout}>
					{t('operationProfiles.nodeEditor.autoLayout')}
				</Button>
				<Button leftSection={<FloppyDiskIcon />} disabled={!isDirty} onClick={onSave}>
					{t('common.save')}
				</Button>
				<Button variant="default" leftSection={<XIcon />} onClick={onClose}>
					{t('common.close')}
				</Button>
			</Group>
		</Group>
	);
};
