export class AsyncResourceCache<Key, Value> {
	private readonly values = new Map<Key, Value>();
	private readonly inFlight = new Map<Key, Promise<Value>>();

	load(key: Key, loader: () => Promise<Value>, force = false): Promise<Value> {
		if (!force && this.values.has(key)) {
			return Promise.resolve(this.values.get(key) as Value);
		}

		const pending = this.inFlight.get(key);
		if (pending) return pending;

		const request = loader()
			.then((value) => {
				this.values.set(key, value);
				return value;
			})
			.finally(() => this.inFlight.delete(key));
		this.inFlight.set(key, request);
		return request;
	}

	set(key: Key, value: Value): void {
		this.values.set(key, value);
	}

	peek(key: Key): Value | undefined {
		return this.values.get(key);
	}
}
