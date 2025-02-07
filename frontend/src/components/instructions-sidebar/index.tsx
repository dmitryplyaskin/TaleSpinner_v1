import { useUnit } from 'effector-react';
import { useEffect } from 'react';
import { InstructionEditor } from './instruction-editor';
import { instructionsModel } from '@model/instructions';
import { Drawer } from '@ui/drawer';
import { Box } from '@chakra-ui/react';
import { Flex } from '@chakra-ui/react';
import { LuTrash2 } from 'react-icons/lu';
import { LuPlus } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { LuCopy } from 'react-icons/lu';
import { CustomAutocomplete } from '@ui/custom-autocomplete';

export const InstructionsSidebar = () => {
	const instructions = useUnit(instructionsModel.$items);
	const settings = useUnit(instructionsModel.$settings);

	useEffect(() => {
		instructionsModel.getItemsFx();
		instructionsModel.getSettingsFx();
	}, []);

	return (
		<Drawer name="instructions" title="Инструкции">
			<Flex gap={2}>
				<CustomAutocomplete
					value={settings?.selectedId ? [settings.selectedId] : []}
					onChange={(value) => instructionsModel.updateSettingsFx({ ...settings, selectedId: value[0] })}
					options={instructions.map((instr) => ({
						label: instr.name,
						value: instr.id,
					}))}
				/>
				<Box display="flex" gap={2} alignSelf="flex-end">
					<IconButtonWithTooltip
						tooltip="Создать инструкцию"
						icon={<LuPlus />}
						aria-label="Create instruction"
						onClick={() => {}}
					/>

					<IconButtonWithTooltip
						tooltip="Дублировать инструкцию"
						icon={<LuCopy />}
						aria-label="Duplicate instruction"
						onClick={() => {}}
					/>
					<IconButtonWithTooltip
						tooltip="Удалить инструкцию"
						icon={<LuTrash2 />}
						aria-label="Delete instruction"
						onClick={() => {}}
					/>
				</Box>
			</Flex>
			<InstructionEditor />
		</Drawer>
	);
};
