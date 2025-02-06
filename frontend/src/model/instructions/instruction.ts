import { InstructionType } from '@shared/types/instructions';
import { createEffect, createEvent, createStore, sample } from 'effector';
import { apiRoutes } from '../../api-routes';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../utils/async-handler';

export const createEmptyInstruction = (): InstructionType => ({
	id: uuidv4(),
	name: 'Новая инструкция',
	instruction: '',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
});

export const $instructions = createStore<InstructionType[]>([]);

export const updateInstruction = createEvent<InstructionType>();
export const deleteInstruction = createEvent<string>();
export const createInstruction = createEvent<InstructionType>();

$instructions
	.on(updateInstruction, (instructions, instruction) => {
		const updatedInstructions = instructions.map((instr) => {
			if (instr.id === instruction.id) {
				return instruction;
			}
			return instr;
		});
		return updatedInstructions;
	})
	.on(createInstruction, (instructions, instruction) => {
		return [...instructions, instruction];
	})
	.on(deleteInstruction, (instructions, id) => {
		return instructions.filter((instr) => instr.id !== id);
	});

export const getInstructionsListFx = createEffect<void, { data: InstructionType[] }>(() =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.instructions.list());
		return response.json();
	}, 'Error fetching instructions list'),
);

$instructions.on(getInstructionsListFx.doneData, (_, { data }) => data);

export const getInstructionFx = createEffect<string, { data: InstructionType }>((id) =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.instructions.getById(id));
		return response.json();
	}, 'Error fetching instruction'),
);

export const updateInstructionFx = createEffect<InstructionType, void>((instruction) =>
	asyncHandler(async () => {
		await fetch(apiRoutes.instructions.update(instruction.id), {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(instruction),
		});
	}, 'Error updating instruction'),
);

export const createInstructionFx = createEffect<InstructionType, void>((instruction) =>
	asyncHandler(async () => {
		await fetch(apiRoutes.instructions.create(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(instruction),
		});
	}, 'Error creating instruction'),
);

export const deleteInstructionFx = createEffect<string, void>((id) =>
	asyncHandler(async () => {
		await fetch(apiRoutes.instructions.delete(id), {
			method: 'DELETE',
		});
	}, 'Error deleting instruction'),
);

sample({
	clock: updateInstruction,
	target: updateInstructionFx,
});

sample({
	clock: createInstruction,
	target: createInstructionFx,
});

sample({
	clock: deleteInstruction,
	target: deleteInstructionFx,
});

sample({
	clock: [updateInstructionFx, createInstructionFx, deleteInstructionFx],
	target: getInstructionsListFx,
});
