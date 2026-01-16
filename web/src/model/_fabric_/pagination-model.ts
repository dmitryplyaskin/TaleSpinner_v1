import { createStore, createEvent, sample, combine, Store, Effect } from 'effector';
import { CommonModelItemType, CommonModelSettingsType } from '@shared/types/common-model-types';

export interface PaginationSettings {
	currentPage: number;
	pageSize: number;
	totalItems: number;
}

export interface PaginationModel<ItemType extends CommonModelItemType> {
	// Сторы
	$paginationSettings: Store<PaginationSettings>;
	$paginatedItems: Store<ItemType[]>;
	$totalPages: Store<number>;
	$isPaginationNeeded: Store<boolean>;

	// События
	setCurrentPage: (page: number) => void;
	setPageSize: (size: number) => void;
}

export const createPaginationModel = <
	ItemType extends CommonModelItemType,
	SettingsType extends CommonModelSettingsType,
>(
	$items: Store<ItemType[]>,
	defaultPageSize: number = 10,
	updateSettingsFx: Effect<Partial<SettingsType>, any>,
	getSettingsFx: Effect<void, { data: SettingsType }>,
): PaginationModel<ItemType> => {
	// События для управления пагинацией
	const setCurrentPage = createEvent<number>();
	const setPageSize = createEvent<number>();
	const setPageSizeFromSettings = createEvent<number>();

	// Стор с настройками пагинации
	const $paginationSettings = createStore<PaginationSettings>({
		currentPage: 1,
		pageSize: defaultPageSize,
		totalItems: 0,
	});

	$paginationSettings.on(setPageSizeFromSettings, (state, pageSize) => ({
		...state,
		pageSize,
	}));

	// Обновляем totalItems при изменении списка элементов
	sample({
		clock: $items,
		source: $paginationSettings,
		fn: (settings, items) => ({
			...settings,
			totalItems: items.length,
		}),
		target: $paginationSettings,
	});

	// Обработчики событий
	$paginationSettings
		.on(setCurrentPage, (state, page) => ({
			...state,
			currentPage: page,
		}))
		.on(setPageSize, (state, size) => ({
			...state,
			pageSize: size,
			// Сбрасываем на первую страницу при изменении размера страницы
			currentPage: 1,
		}));

	// Вычисляем общее количество страниц
	const $totalPages = $paginationSettings.map(({ totalItems, pageSize }) =>
		Math.max(1, Math.ceil(totalItems / pageSize)),
	);

	sample({
		clock: setPageSize,
		fn: (pageSize) => ({ pageSize } as Partial<SettingsType>),
		target: updateSettingsFx,
	});

	// Фильтруем элементы для текущей страницы
	const $paginatedItems = combine($items, $paginationSettings, (items, { currentPage, pageSize }) => {
		const startIndex = (currentPage - 1) * pageSize;
		const endIndex = startIndex + pageSize;
		return items.slice(startIndex, endIndex);
	});

	// Определяем, нужна ли пагинация
	const $isPaginationNeeded = combine($paginationSettings, ({ totalItems, pageSize }) => totalItems > pageSize);

	// I don't like this code, but it works
	let firstSettingsInit = false;
	getSettingsFx.doneData.watch(({ data }) => {
		if (!firstSettingsInit) {
			firstSettingsInit = true;
			if (data.pageSize) {
				setPageSizeFromSettings(data.pageSize);
			}
		}
	});

	return {
		$paginationSettings,
		$paginatedItems,
		$totalPages,
		$isPaginationNeeded,

		setCurrentPage,
		setPageSize,
	};
};
