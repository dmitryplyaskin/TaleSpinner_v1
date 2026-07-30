import { availableParallelism } from 'node:os';

import { defineConfig } from 'vitest/config';

// Preserve host responsiveness without giving up useful file-level parallelism.
const CPU_BUDGET_RATIO = 0.4;
const MAX_WORKERS = 8;
const maxWorkers = Math.max(1, Math.min(MAX_WORKERS, Math.floor(availableParallelism() * CPU_BUDGET_RATIO)));

export default defineConfig({
	resolve: {
		tsconfigPaths: true,
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts'],
		maxWorkers,
	},
});
