// Функция для получения значения по пути в объекте
export function getValueByPath(obj: any, path: string): any {
	if (!path) return obj;

	const keys = path.split('.');
	let value = obj;

	for (const key of keys) {
		if (value === null || value === undefined) return undefined;
		value = value[key];
	}

	return value;
}

// Создает функцию сортировки для строковых значений
export function createStringSortFunction<ItemType>(
	path: string,
	ascending: boolean = true,
): (a: ItemType, b: ItemType) => number {
	return (a, b) => {
		const valueA = getValueByPath(a, path) || '';
		const valueB = getValueByPath(b, path) || '';
		return ascending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
	};
}

// Создает функцию сортировки для числовых значений
export function createNumberSortFunction<ItemType>(
	path: string,
	ascending: boolean = true,
): (a: ItemType, b: ItemType) => number {
	return (a, b) => {
		const valueA = getValueByPath(a, path) || 0;
		const valueB = getValueByPath(b, path) || 0;
		return ascending ? valueA - valueB : valueB - valueA;
	};
}

// Создает функцию сортировки для дат
export function createDateSortFunction<ItemType>(
	path: string,
	ascending: boolean = true,
): (a: ItemType, b: ItemType) => number {
	return (a, b) => {
		const valueA = new Date(getValueByPath(a, path) || 0).getTime();
		const valueB = new Date(getValueByPath(b, path) || 0).getTime();
		return ascending ? valueA - valueB : valueB - valueA;
	};
}

// Создает функцию фильтрации для строковых значений (поиск подстроки)
export function createStringFilterFunction<ItemType>(path: string): (item: ItemType, filterValue: string) => boolean {
	return (item, filterValue) => {
		if (!filterValue) return true;
		const value = String(getValueByPath(item, path) || '').toLowerCase();
		return value.includes(filterValue.toLowerCase());
	};
}

// Создает функцию фильтрации для числовых значений (равенство)
export function createNumberFilterFunction<ItemType>(path: string): (item: ItemType, filterValue: number) => boolean {
	return (item, filterValue) => {
		if (filterValue === undefined || filterValue === null) return true;
		const value = getValueByPath(item, path);
		return value === filterValue;
	};
}

// Создает функцию фильтрации для числовых значений (диапазон)
export function createNumberRangeFilterFunction<ItemType>(
	path: string,
): (item: ItemType, filterValue: { min?: number; max?: number }) => boolean {
	return (item, filterValue) => {
		if (!filterValue) return true;

		const value = getValueByPath(item, path);
		if (value === undefined || value === null) return false;

		const { min, max } = filterValue;
		if (min !== undefined && value < min) return false;
		if (max !== undefined && value > max) return false;

		return true;
	};
}

// Создает функцию фильтрации для булевых значений
export function createBooleanFilterFunction<ItemType>(path: string): (item: ItemType, filterValue: boolean) => boolean {
	return (item, filterValue) => {
		if (filterValue === undefined || filterValue === null) return true;
		const value = getValueByPath(item, path);
		return value === filterValue;
	};
}
