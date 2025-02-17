import { Button, VStack } from '@chakra-ui/react';
import { LuPlus } from 'react-icons/lu';
import { useFieldArray, FormProvider, useForm } from 'react-hook-form';
import { PipelineItem } from './pipeline-item';
import { createEmptyPipeline, pipelinesModel } from '@model/pipelines';
import { useUnit } from 'effector-react';
import { PipelineType } from '@shared/types/pipelines';
import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

export const PipelineForm = () => {
	const selectedPipeline = useUnit(pipelinesModel.$selectedItem);

	const methods = useForm<PipelineType>({
		defaultValues: selectedPipeline || createEmptyPipeline(),
	});

	useEffect(() => {
		methods.reset(selectedPipeline || createEmptyPipeline());
	}, [selectedPipeline]);

	const { fields, append, remove, move } = useFieldArray({
		control: methods.control,
		name: 'pipelines',
	});

	const handleAddPipeline = () => {
		append({
			name: '',
			tag: '',
			prompt: '',
			enabled: false,
			id: uuidv4(),
		});
	};

	const onSubmit = (data: PipelineType) => {
		if (selectedPipeline) {
			pipelinesModel.updateItemFx({ ...data, updatedAt: new Date().toISOString() });
		} else {
			pipelinesModel.createItemFx(data);
		}
	};

	return (
		<FormProvider {...methods}>
			<VStack gap={2} align="stretch">
				{fields.map((field, index) => (
					<PipelineItem
						key={field.id}
						index={index}
						onRemove={() => remove(index)}
						onMoveUp={() => move(index, index - 1)}
						onMoveDown={() => move(index, index + 1)}
						isFirst={index === 0}
						isLast={index === fields.length - 1}
					/>
				))}
			</VStack>
			<Button onClick={handleAddPipeline} colorScheme="blue">
				<LuPlus />
				Add Pipeline
			</Button>
			<Button onClick={methods.handleSubmit(onSubmit)} colorScheme="blue">
				Save
			</Button>
		</FormProvider>
	);
};
