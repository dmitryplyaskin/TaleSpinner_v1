import { createEffect, StoreWritable } from 'effector';
import { FabricItems } from './types';
import { CommonModelItemType } from '@shared/types/common-model-types';
import { asyncHandler } from '@model/utils/async-handler';
import { v4 as uuidv4 } from 'uuid';

export const createItemsModel = <ItemType extends CommonModelItemType>(
	itemsParams: FabricItems<ItemType>,
	$items: StoreWritable<ItemType[]>,
	fabricName: string,
) => {
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

	const createItemFx = createEffect<ItemType, { data: ItemType }>((item) =>
		asyncHandler(async () => {
			const response = await fetch(itemsParams.route, { method: 'POST', body: JSON.stringify(item) });
			return response.json();
		}, `Error creating ${fabricName} item`),
	);

	const updateItemFx = createEffect<ItemType, { data: ItemType }>((item) =>
		asyncHandler(async () => {
			const response = await fetch(itemsParams.route + '/' + item.id, { method: 'PUT', body: JSON.stringify(item) });
			return response.json();
		}, `Error updating ${fabricName} item`),
	);

	const deleteItemFx = createEffect<string, { data: ItemType }>((id) =>
		asyncHandler(async () => {
			if (!window.confirm(`Вы уверены, что хотите удалить этот ${fabricName}?`)) {
				return;
			}
			const response = await fetch(itemsParams.route + '/' + id, { method: 'DELETE' });
			return response.json();
		}, `Error deleting ${fabricName} item`),
	);

	const duplicateItemFx = createEffect<ItemType, { data: ItemType }>((item) =>
		asyncHandler(async () => {
			const newItem = { ...item, id: uuidv4(), name: `${item.name} (copy)` };
			const response = await fetch(itemsParams.route, { method: 'POST', body: JSON.stringify(newItem) });
			return response.json();
		}, `Error duplicating ${fabricName} item`),
	);

	$items
		.on(getItemsFx.doneData, (_, { data }) => data)
		.on(getItemByIdFx.doneData, (state, { data }) =>
			state.some((item) => item.id === data.id)
				? state.map((item) => (item.id === data.id ? data : item))
				: [...state, data],
		);

	$items
		.on([createItemFx.doneData, duplicateItemFx.doneData], (state, { data }) => [...state, data])
		.on(updateItemFx.doneData, (state, { data }) => state.map((i) => (i.id === data.id ? data : i)))
		.on(deleteItemFx.done, (state, { params }) => state.filter((i) => i.id !== params));

	return {
		getItemsFx,
		getItemByIdFx,
		createItemFx,
		updateItemFx,
		deleteItemFx,
		duplicateItemFx,
	};
};
