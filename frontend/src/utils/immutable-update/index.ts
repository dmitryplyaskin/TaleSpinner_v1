type PathCriteria<T> = {
	find: [keyof T, T[keyof T]] | Partial<T>;
};

type PathElement<T> =
	| keyof T
	| PathCriteria<T>
	| { [K in keyof T]?: T[K] extends Array<infer U> ? PathElement<U> : never };

type Path<T> = Array<PathElement<T>>;

type UpdaterFn<T> = (current: T) => T;
type Updater<T> = T | UpdaterFn<T>;

export class Immutable<T> {
	private constructor(private value: T) {}

	static of<U>(value: U): Immutable<U> {
		return new Immutable(value);
	}

	get(): T {
		return this.value;
	}

	update<U>(path: Path<T>, updater: Updater<U>): Immutable<T> {
		return new Immutable(this.modify(this.value, path, updater));
	}

	filter<Item>(path: Path<T>, predicate: (item: Item) => boolean): Immutable<T> {
		return this.update<Item[]>(path, (arr) => arr.filter(predicate));
	}

	sort<Item>(path: Path<T>, compareFn: (a: Item, b: Item) => number): Immutable<T> {
		return this.update<Item[]>(path, (arr) => [...arr].sort(compareFn));
	}

	insert<Item>(path: Path<T>, items: Item | Item[], position: 'start' | 'end' = 'end'): Immutable<T> {
		return this.update<Item[]>(path, (arr) => {
			const newItems = Array.isArray(items) ? items : [items];
			return position === 'start' ? [...newItems, ...arr] : [...arr, ...newItems];
		});
	}

	merge<Item>(path: Path<T>, items: Item[]): Immutable<T> {
		return this.update<Item[]>(path, (arr) => [...arr, ...items]);
	}

	upsert<Item extends Record<string, any>>(
		path: Path<T>,
		matcher: (item: Item) => boolean,
		newItem: Item,
	): Immutable<T> {
		return this.update<Item[]>(path, (arr) => {
			const index = arr.findIndex(matcher);
			return index >= 0 ? arr.map((item, i) => (i === index ? { ...item, ...newItem } : item)) : [...arr, newItem];
		});
	}

	private modify<U>(currentValue: any, path: Path<any>, updater: Updater<U>): any {
		const resolveUpdater = (value: U): U => {
			return typeof updater === 'function' ? (updater as UpdaterFn<U>)(value) : updater;
		};

		if (path.length === 0) {
			return resolveUpdater(currentValue);
		}

		const [currentStep, ...remainingPath] = path;

		// Handle array operations
		if (typeof currentStep === 'object' && currentStep !== null) {
			if (!Array.isArray(currentValue)) return currentValue;

			const criteria = (currentStep as PathCriteria<any>).find;
			const entries = Array.isArray(criteria) ? criteria : Object.entries(criteria);

			return currentValue.map((item: any) => {
				const match = entries.every(([key, value]) => item[key] === value);
				return match ? this.modify(item, remainingPath, updater) : item;
			});
		}

		const key = currentStep as keyof typeof currentValue;

		if (currentValue === undefined || currentValue === null) {
			return currentValue;
		}

		if (Array.isArray(currentValue)) {
			const index = Number(key);
			if (!isNaN(index) && index >= 0 && index < currentValue.length) {
				const modified = this.modify(currentValue[index], remainingPath, updater);
				return currentValue.map((item, i) => (i === index ? modified : item));
			}
		}

		const nestedValue = currentValue[key];
		const modified = this.modify(nestedValue, remainingPath, updater);

		if (modified === nestedValue) {
			return currentValue;
		}

		return Array.isArray(currentValue) ? [...currentValue] : { ...currentValue, [key]: modified };
	}
}
