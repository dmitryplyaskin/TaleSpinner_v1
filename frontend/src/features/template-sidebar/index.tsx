import { useUnit } from 'effector-react';
import { useEffect } from 'react';
import { TemplateEditor } from './template-editor';
import { createEmptyTemplate, templatesModel } from '@model/template';
import { Drawer } from '@ui/drawer';
import { Box } from '@chakra-ui/react';
import { Flex } from '@chakra-ui/react';
import { LuTrash2 } from 'react-icons/lu';

import { LuPlus } from 'react-icons/lu';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { LuCopy } from 'react-icons/lu';
import { TemplateType } from '@shared/types/templates';
import { Select } from 'chakra-react-select';

export const TemplateSidebar = () => {
	const templates = useUnit(templatesModel.$items);
	const settings = useUnit(templatesModel.$settings);

	const options = templates.map((instr) => ({
		label: instr.name,
		value: instr.id,
	}));

	useEffect(() => {
		templatesModel.getItemsFx();
		templatesModel.getSettingsFx();
	}, []);

	return (
		<Drawer name="templates" title="Шаблоны">
			<Flex gap={2}>
				<Select
					value={settings?.selectedId ? options.find((instr) => instr.value === settings.selectedId) : null}
					onChange={(selected) => templatesModel.updateSettingsFx({ ...settings, selectedId: selected?.value })}
					options={options}
				/>

				<Box display="flex" gap={2} alignSelf="flex-end">
					<IconButtonWithTooltip
						tooltip="Создать шаблон"
						icon={<LuPlus />}
						aria-label="Create template"
						onClick={() => templatesModel.createItemFx(createEmptyTemplate())}
					/>
					<IconButtonWithTooltip
						tooltip="Дублировать шаблон"
						icon={<LuCopy />}
						aria-label="Duplicate template"
						disabled={!settings.selectedId}
						onClick={() =>
							templatesModel.duplicateItemFx(
								templates.find((instr) => instr.id === settings.selectedId) as TemplateType,
							)
						}
					/>

					<IconButtonWithTooltip
						tooltip="Удалить шаблон"
						icon={<LuTrash2 />}
						aria-label="Delete template"
						disabled={!settings.selectedId}
						onClick={() => templatesModel.deleteItemFx(settings.selectedId as string)}
					/>
				</Box>
			</Flex>

			{settings.selectedId && <TemplateEditor />}
		</Drawer>
	);
};
