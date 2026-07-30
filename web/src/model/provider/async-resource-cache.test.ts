import { describe, expect, test, vi } from 'vitest';

import { AsyncResourceCache } from './async-resource-cache';

describe('AsyncResourceCache', () => {
	test('reuses a loaded value until a forced refresh', async () => {
		const cache = new AsyncResourceCache<string, string[]>();
		const loader = vi.fn().mockResolvedValueOnce(['first']).mockResolvedValueOnce(['refreshed']);

		await expect(cache.load('models', loader)).resolves.toEqual(['first']);
		await expect(cache.load('models', loader)).resolves.toEqual(['first']);
		await expect(cache.load('models', loader, true)).resolves.toEqual(['refreshed']);
		expect(loader).toHaveBeenCalledTimes(2);
	});

	test('shares an in-flight request between consumers', async () => {
		const cache = new AsyncResourceCache<string, string>();
		let resolveRequest: ((value: string) => void) | undefined;
		const loader = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					resolveRequest = resolve;
				}),
		);

		const first = cache.load('providers', loader);
		const second = cache.load('providers', loader);
		resolveRequest?.('ready');

		await expect(Promise.all([first, second])).resolves.toEqual(['ready', 'ready']);
		expect(loader).toHaveBeenCalledTimes(1);
	});

	test('retries after a failed request', async () => {
		const cache = new AsyncResourceCache<string, string>();
		const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce('ready');

		await expect(cache.load('tokens', loader)).rejects.toThrow('offline');
		await expect(cache.load('tokens', loader)).resolves.toBe('ready');
		expect(loader).toHaveBeenCalledTimes(2);
	});
});
