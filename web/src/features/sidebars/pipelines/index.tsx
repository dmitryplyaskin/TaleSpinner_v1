import { Flex, Stack, Switch } from '@mantine/core';
import { type PipelineSettingsType } from '@shared/types/pipelines';
import { useUnit } from 'effector-react';
import React from 'react';

import { createEmptyPipeline, pipelinesModel } from '@model/pipelines';
import { Drawer } from '@ui/drawer';

import { SidebarHeader } from '../common/sidebar-header';

import { PipelineForm } from './pipeline-form';

export const PipelineSidebar: React.FC = () => {
	const pipelines = useUnit(pipelinesModel.$items);
	const settings = useUnit(pipelinesModel.$settings);

	const handleSettingsChange = (newSettings: Partial<PipelineSettingsType>) => {
		pipelinesModel.updateSettingsFx({ ...settings, ...newSettings });
	};

	return (
		<Drawer name="pipeline" title="Pipeline">
			<Stack gap="md">
				<SidebarHeader
					model={pipelinesModel}
					items={pipelines}
					settings={settings}
					name="pipeline"
					createEmptyItem={createEmptyPipeline}
					labels={{
						createTooltip: 'Создать инструкцию',
						duplicateTooltip: 'Дублировать инструкцию',
						deleteTooltip: 'Удалить инструкцию',
						createAriaLabel: 'Create instruction',
						duplicateAriaLabel: 'Duplicate instruction',
						deleteAriaLabel: 'Delete instruction',
					}}
				/>
				<Flex gap="md" wrap="wrap">
					<Switch
						checked={settings.enabled}
						onChange={(e) => handleSettingsChange({ enabled: e.currentTarget.checked })}
						color="green"
						label="Enable pipelines"
						description="Enable pipelines to use them in chat"
					/>
					<Switch
						checked={settings.isFullPipelineProcessing}
						onChange={(e) => handleSettingsChange({ isFullPipelineProcessing: e.currentTarget.checked })}
						label="Full pipeline processing"
						description="Completely replaces response generation and is entirely based on pipelines."
					/>
				</Flex>
				<PipelineForm />
			</Stack>
		</Drawer>
	);
};
