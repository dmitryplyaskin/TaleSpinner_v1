import { type CommonModelItemType } from '@shared/types/common-model-types';
import { createEffect, createEvent, createStore } from 'effector';
import { debounce } from 'patronum/debounce';
import { v4 as uuidv4 } from 'uuid';

import { asyncHandler } from '@model/utils/async-handler';

import { BASE_URL } from '../../const';

import { type FabricItems } from './types';




export const createItemsModel = <ItemType extends CommonModelItemType>(
	itemsParams: FabricItems<ItemType>,
	fabricName: string,
) => {
	const $items = createStore<ItemType[]>(itemsParams.defaultValue || []);
	const changeItem = createEvent<ItemType>();

	const getItemsFx = createEffect<void, { data: ItemType[] }>(() =>
		asyncHandler(async () => {
			const response = await fetch(`${BASE_URL}${itemsParams.route}`);
			return response.json();
		}, `Error fetching ${fabricName} items`),
	);

	const getItemByIdFx = createEffect<string, { data: ItemType }>((id) =>
		asyncHandler(async () => {
			const response = await fetch(`${BASE_URL}${itemsParams.route}/${id}`);
			return response.json();
		}, `Error fetching ${fabricName} item by id`),
	);

	const createItemFx = createEffect<ItemType, { data: ItemType }>((item) =>
		asyncHandler(async () => {
			const response = await fetch(`${BASE_URL}${itemsParams.route}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(item),
			});
			return response.json();
		}, `Error creating ${fabricName} item`),
	);

	const updateItemFx = createEffect<ItemType, { data: ItemType }>((item) =>
		asyncHandler(async () => {
			const newItem = { ...item, updatedAt: new Date().toISOString() };
			const response = await fetch(`${BASE_URL}${itemsParams.route}/${item.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(newItem),
			});

			return response.json();
		}, `Error updating ${fabricName} item`),
	);

	const deleteItemFx = createEffect<string, { data: ItemType }>((id) =>
		asyncHandler(async () => {
			if (!window.confirm(`Вы уверены, что хотите удалить этот ${fabricName}?`)) {
				return;
			}
			const response = await fetch(`${BASE_URL}${itemsParams.route}/${id}`, {
				method: 'DELETE',
			});
			return response.json();
		}, `Error deleting ${fabricName} item`),
	);

	const duplicateItemFx = createEffect<ItemType, { data: ItemType }>((item) =>
		asyncHandler(async () => {
			const newItem = {
				...item,
				id: uuidv4(),
				name: `${item.name} (copy)`,
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			};
			const response = await fetch(`${BASE_URL}${itemsParams.route}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(newItem),
			});
			return response.json();
		}, `Error duplicating ${fabricName} item`),
	);

	const changeItemDebounced = createEvent<ItemType>();
	const changeItemDebounced_ = debounce(changeItemDebounced, 1000);

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
		.on(deleteItemFx.doneData, (state, { data }) => state.filter((i) => i.id !== data.id))
		.on([changeItem, changeItemDebounced_], (state, item) => state.map((i) => (i.id === item.id ? item : i)));

	return {
		$items,
		getItemsFx,
		getItemByIdFx,
		createItemFx,
		updateItemFx,
		deleteItemFx,
		duplicateItemFx,
		changeItem,
		changeItemDebounced,
	};
};
