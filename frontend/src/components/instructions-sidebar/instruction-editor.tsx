import { Box, Flex } from '@chakra-ui/react';
import { FormProvider, useForm } from 'react-hook-form';
import { FormTextarea } from '@ui/form-components/form-textarea';
import { FormAutocomplete } from '@ui/form-components/form-autocomplete';
import { InstructionType } from '@shared/types/instructions';
import { LuCopy, LuPlus, LuTrash2 } from 'react-icons/lu';
import { createEmptyInstruction, createInstruction, deleteInstruction, updateInstruction } from '@model/instructions';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { FormInput } from '@ui/form-components';

type InstructionEditorProps = {
	instructions: InstructionType[];
	selectedInstruction: InstructionType | null;
	onSelect: (instruction: InstructionType | null) => void;
};

export const InstructionEditor: React.FC<InstructionEditorProps> = ({
	instructions,
	selectedInstruction,
	onSelect,
}) => {
	const methods = useForm<InstructionType>({
		defaultValues: selectedInstruction || createEmptyInstruction(),
	});

	const { handleSubmit, reset, watch } = methods;

	const onSubmit = (data: InstructionType) => {
		if (selectedInstruction) {
			updateInstruction({ ...data, updatedAt: new Date().toISOString() });
		}
	};

	const handleCreate = () => {
		const newInstruction = createEmptyInstruction();
		createInstruction(newInstruction);
		onSelect(newInstruction);
		reset(newInstruction);
	};

	const handleDuplicate = () => {
		if (!selectedInstruction) return;
		const newInstruction = {
			...selectedInstruction,
			id: crypto.randomUUID(),
			name: `${selectedInstruction.name} (копия)`,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};
		createInstruction(newInstruction);
		onSelect(newInstruction);
		reset(newInstruction);
	};

	const handleDelete = () => {
		if (!selectedInstruction) return;
		deleteInstruction(selectedInstruction.id);
		onSelect(null);
		reset(createEmptyInstruction());
	};

	const currentInstruction = watch();

	return (
		<FormProvider {...methods}>
			<form onChange={handleSubmit(onSubmit)} style={{ height: '100%' }}>
				<Flex direction="column" h="100%" gap={4} p={4}>
					<Flex gap={2}>
						<FormAutocomplete
							name="id"
							label="Инструкция"
							options={instructions.map((instr) => ({
								label: instr.name,
								value: instr.id,
							}))}
							onChange={(value) => {
								const selected = instructions.find((instr) => instr.id === value);
								if (selected) {
									onSelect(selected);
									reset(selected);
								}
							}}
							value={currentInstruction.id}
						/>
						<Box display="flex" gap={2} alignSelf="flex-end">
							<IconButtonWithTooltip
								tooltip="Создать инструкцию"
								icon={<LuPlus />}
								aria-label="Create instruction"
								onClick={handleCreate}
							/>

							<IconButtonWithTooltip
								tooltip="Дублировать инструкцию"
								icon={<LuCopy />}
								aria-label="Duplicate instruction"
								onClick={handleDuplicate}
							/>
							<IconButtonWithTooltip
								tooltip="Удалить инструкцию"
								icon={<LuTrash2 />}
								aria-label="Delete instruction"
								onClick={handleDelete}
							/>
						</Box>
					</Flex>

					<FormInput name="name" label="Название" placeholder="Введите название инструкции" />

					<FormTextarea
						name="instruction"
						label="Инструкция"
						placeholder="Введите текст инструкции"
						textareaProps={{
							minHeight: '300px',
						}}
					/>
				</Flex>
			</form>
		</FormProvider>
	);
};
