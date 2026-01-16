import { useUnit } from 'effector-react';
import { useEffect } from 'react';
import { InstructionEditor } from './instruction-editor';
import { createEmptyInstruction, instructionsModel } from '@model/instructions';
import { Drawer } from '@ui/drawer';
import { SidebarHeader } from '../common/sidebar-header';

export const InstructionsSidebar = () => {
	const instructions = useUnit(instructionsModel.$items);
	const settings = useUnit(instructionsModel.$settings);

	useEffect(() => {
		instructionsModel.getItemsFx();
		instructionsModel.getSettingsFx();
	}, []);

	return (
		<Drawer name="instructions" title="Инструкции">
			<SidebarHeader
				model={instructionsModel}
				items={instructions}
				settings={settings}
				name="instruction"
				createEmptyItem={createEmptyInstruction}
				labels={{
					createTooltip: 'Создать инструкцию',
					duplicateTooltip: 'Дублировать инструкцию',
					deleteTooltip: 'Удалить инструкцию',
					createAriaLabel: 'Create instruction',
					duplicateAriaLabel: 'Duplicate instruction',
					deleteAriaLabel: 'Delete instruction',
				}}
			/>

			{settings.selectedId && <InstructionEditor />}
		</Drawer>
	);
};
