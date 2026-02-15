import { type CommonModelItemType } from '@shared/types/common-model-types';
import { createEffect, createEvent, createStore } from 'effector';
import { debounce } from 'patronum/debounce';
import { v4 as uuidv4 } from 'uuid';

import { asyncHandler } from '@model/utils/async-handler';

import { BASE_URL } from '../../const';
import i18n from '../../i18n';


import { type FabricItems } from './types';

async function safeReadJson(response: Response): Promise<unknown> {
	const text = await response.text();
	try {
		return text ? JSON.parse(text) : {};
	} catch {
		throw new Error(`HTTP ${response.status} ${response.statusText}`);
	}
}




export const createItemsModel = <ItemType extends CommonModelItemType>(
	itemsParams: FabricItems<ItemType>,
	fabricName: string,
) => {
	const $items = createStore<ItemType[]>(itemsParams.defaultValue || []);
	const changeItem = createEvent<ItemType>();

	const getItemsFx = createEffect<void, { data: ItemType[] }>(() =>
		asyncHandler(async () => {
			const response = await fetch(`${BASE_URL}${itemsParams.route}`);
			const json = (await safeReadJson(response)) as { data: ItemType[]; error?: any };
			if (!response.ok) {
				const message = json?.error?.message ?? `HTTP error ${response.status}`;
				throw new Error(message);
			}
			return json;
		}, `Error fetching ${fabricName} items`),
	);

	const getItemByIdFx = createEffect<string, { data: ItemType }>((id) =>
		asyncHandler(async () => {
			const response = await fetch(`${BASE_URL}${itemsParams.route}/${id}`);
			const json = (await safeReadJson(response)) as { data: ItemType; error?: any };
			if (!response.ok) {
				const message = json?.error?.message ?? `HTTP error ${response.status}`;
				throw new Error(message);
			}
			return json;
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
			const json = (await safeReadJson(response)) as { data: ItemType; error?: any };
			if (!response.ok) {
				const message = json?.error?.message ?? `HTTP error ${response.status}`;
				throw new Error(message);
			}
			return json;
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

			const json = (await safeReadJson(response)) as { data: ItemType; error?: any };
			if (!response.ok) {
				const message = json?.error?.message ?? `HTTP error ${response.status}`;
				throw new Error(message);
			}
			return json;
		}, `Error updating ${fabricName} item`),
	);

	const deleteItemFx = createEffect<string, { data: ItemType } | undefined>((id) =>
		asyncHandler(async () => {
			if (!window.confirm(i18n.t('common.confirmDeleteEntity', { name: fabricName }))) {
				return;
			}
			const response = await fetch(`${BASE_URL}${itemsParams.route}/${id}`, {
				method: 'DELETE',
			});
			const json = (await safeReadJson(response)) as { data: ItemType; error?: any };
			if (!response.ok) {
				const message = json?.error?.message ?? `HTTP error ${response.status}`;
				throw new Error(message);
			}
			return json;
		}, `Error deleting ${fabricName} item`),
	);

	const duplicateItemFx = createEffect<ItemType, { data: ItemType }>((item) =>
		asyncHandler(async () => {
			const newItem = {
				...item,
				id: uuidv4(),
				name: i18n.t('common.copyName', { name: item.name }),
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
			const json = (await safeReadJson(response)) as { data: ItemType; error?: any };
			if (!response.ok) {
				const message = json?.error?.message ?? `HTTP error ${response.status}`;
				throw new Error(message);
			}
			return json;
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
		.on(deleteItemFx.doneData, (state, payload) => {
			if (!payload) return state;
			return state.filter((i) => i.id !== payload.data.id);
		})
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
