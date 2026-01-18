import { Button, Text, VStack } from '@chakra-ui/react';
import { type PipelineType } from '@shared/types/pipelines';
import { useUnit } from 'effector-react';
import { useEffect, useRef } from 'react';
import { useFieldArray, FormProvider, useForm } from 'react-hook-form';
import { LuPlus } from 'react-icons/lu';
import { v4 as uuidv4 } from 'uuid';

import { createEmptyPipeline, pipelinesModel } from '@model/pipelines';

import { PipelineItem } from './pipeline-item';

export const PipelineForm = () => {
	const selectedPipeline = useUnit(pipelinesModel.$selectedItem);
	const ref = useRef<HTMLDivElement>(null);

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
				<Text fontSize="lg" fontWeight="bold">
					Pipelines:
				</Text>
				<VStack gap={2} align="stretch" ref={ref}>
					{fields.map((field, index) => (
						<PipelineItem
							key={field.id}
							index={index}
							onRemove={() => remove(index)}
							onMoveUp={() => move(index, index - 1)}
							onMoveDown={() => move(index, index + 1)}
							isFirst={index === 0}
							isLast={index === fields.length - 1}
							menuPortalTarget={ref.current}
						/>
					))}
				</VStack>
				<Button onClick={handleAddPipeline} colorPalette="blue">
					<LuPlus />
					Add Pipeline
				</Button>
				<Button onClick={methods.handleSubmit(onSubmit)} colorPalette="blue">
					Save Pipelines
				</Button>
			</VStack>
		</FormProvider>
	);
};
