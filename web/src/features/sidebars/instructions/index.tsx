import { useUnit } from 'effector-react';
import { useTranslation } from 'react-i18next';

import { createEmptyInstruction, instructionsModel } from '@model/instructions';
import { Drawer } from '@ui/drawer';

import { SidebarHeader } from '../common/sidebar-header';

import { InstructionEditor } from './instruction-editor';

export const InstructionsSidebar = () => {
	const { t } = useTranslation();
	const instructions = useUnit(instructionsModel.$items);
	const settings = useUnit(instructionsModel.$settings);

	return (
		<Drawer name="instructions" title={t('instructions.title')}>
			<SidebarHeader
				model={instructionsModel}
				items={instructions}
				settings={settings}
				name="instruction"
				createEmptyItem={createEmptyInstruction}
				labels={{
					createTooltip: t('instructions.actions.create'),
					duplicateTooltip: t('instructions.actions.duplicate'),
					deleteTooltip: t('instructions.actions.delete'),
					createAriaLabel: t('instructions.actions.create'),
					duplicateAriaLabel: t('instructions.actions.duplicate'),
					deleteAriaLabel: t('instructions.actions.delete'),
				}}
			/>

			{settings.selectedId && <InstructionEditor />}
		</Drawer>
	);
};
