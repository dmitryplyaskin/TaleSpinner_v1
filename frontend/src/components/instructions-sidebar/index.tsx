import { useUnit } from 'effector-react';
import { useEffect, useState } from 'react';
import { InstructionEditor } from './instruction-editor';
import { $instructions, getInstructionsListFx } from '@model/instructions';
import { InstructionType } from '@shared/types/instructions';
import { Drawer } from '@ui/drawer';

export const InstructionsSidebar = () => {
	const instructions = useUnit($instructions);
	const [selectedInstruction, setSelectedInstruction] = useState<InstructionType | null>(null);

	useEffect(() => {
		getInstructionsListFx();
	}, []);

	return (
		<Drawer name="instructions" title="Инструкции">
			<InstructionEditor
				instructions={instructions}
				selectedInstruction={selectedInstruction}
				onSelect={setSelectedInstruction}
			/>
		</Drawer>
	);
};
