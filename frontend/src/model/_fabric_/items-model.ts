import { createEffect, createEvent, StoreWritable } from 'effector';
import { FabricItems } from './types';
import { CommonModelItemType } from '@shared/types/common-model-types';
import { asyncHandler } from '@model/utils/async-handler';
import { v4 as uuidv4 } from 'uuid';
export const createItemsModel = <ItemType extends CommonModelItemType>(
	itemsParams: FabricItems<ItemType>,
	$items: StoreWritable<ItemType[]>,
	fabricName: string,
) => {
	const getItems = createEvent<void>();
	const getItemById = createEvent<string>();

	const createItem = createEvent<ItemType>();
	const updateItem = createEvent<ItemType>();
	const deleteItem = createEvent<string>();
	const duplicateItem = createEvent<string>();

	const getItemsFx = createEffect<void, { data: ItemType[] }>(() =>
		asyncHandler(async () => {
			const response = await fetch(itemsParams.route);
			return response.json();
		}, `Error fetching ${fabricName} items`),
	);

	const getItemByIdFx = createEffect<string, { data: ItemType }>((id) =>
		asyncHandler(async () => {
			const response = await fetch(itemsParams.route + '/' + id);
			return response.json();
		}, `Error fetching ${fabricName} item by id`),
	);

	$items
		.on(getItemsFx.doneData, (_, { data }) => data)
		.on(getItemByIdFx.doneData, (state, { data }) =>
			state.some((item) => item.id === data.id)
				? state.map((item) => (item.id === data.id ? data : item))
				: [...state, data],
		);

	$items
		.on(createItem, (state, item) => [...state, item])
		.on(updateItem, (state, item) => state.map((i) => (i.id === item.id ? item : i)))
		.on(deleteItem, (state, id) => state.filter((i) => i.id !== id))
		.on(duplicateItem, (state, id) => {
			const item = state.find((i) => i.id === id);
			return item ? [...state, { ...item, id: uuidv4(), name: `${item.name} (copy)` }] : state;
		});

	return {
		getItems,
		getItemById,
		createItem,
		updateItem,
		deleteItem,
		duplicateItem,
	};
};
