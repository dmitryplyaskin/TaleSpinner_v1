import React, { useEffect } from 'react';
import { Flex, VStack } from '@chakra-ui/react';
import { Drawer } from '@ui/drawer';
import { PipelineForm } from './pipeline-form';
import { useUnit } from 'effector-react';
import { createEmptyPipeline, pipelinesModel } from '@model/pipelines';
import { PipelineSettingsType } from '@shared/types/pipelines';
import { Switch } from '@ui/chakra-core-ui/switch';
import { SidebarHeader } from '../common/sidebar-header';

export const PipelineSidebar: React.FC = () => {
	const pipelines = useUnit(pipelinesModel.$items);
	const settings = useUnit(pipelinesModel.$settings);

	useEffect(() => {
		pipelinesModel.getItemsFx();
		pipelinesModel.getSettingsFx();
	}, []);

	const handleSettingsChange = (newSettings: Partial<PipelineSettingsType>) => {
		pipelinesModel.updateSettingsFx({ ...settings, ...newSettings });
	};

	return (
		<Drawer name="pipeline" title="Pipeline">
			<VStack gap={4} align="stretch">
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
				<Flex gap={4}>
					<Switch
						checked={settings.enabled}
						onCheckedChange={(e) => handleSettingsChange({ enabled: e.checked })}
						colorPalette="green"
						infoTip="Enable pipelines to use them in chat"
					>
						Enable pipelines
					</Switch>
					<Switch
						checked={settings.isFullPipelineProcessing}
						onCheckedChange={(e) => handleSettingsChange({ isFullPipelineProcessing: e.checked })}
						infoTip="Completely replaces the way response generation works and is entirely based on pipelines."
					>
						Full pipeline processing
					</Switch>
				</Flex>
				<PipelineForm />
			</VStack>
		</Drawer>
	);
};
