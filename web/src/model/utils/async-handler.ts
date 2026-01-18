import { toaster } from '@ui/toaster';

type ToastType = 'success' | 'error' | 'warning' | 'info';

type AsyncHandlerOptions<T> = {
	onError?: (error: Error) => void;
	onSuccess?: (data: T) => void;
	isLog?: boolean;
	showToast?: boolean;
	toastOptions?: {
		title?: string;
		description?: string;
		type?: ToastType;
		duration?: number;
	};
	retry?: {
		attempts: number;
		delay: number;
	};
};

const defaultOptions = {
	isLog: import.meta.env.LOG_ERRORS === 'true' || true,
	showToast: true,
	toastOptions: {
		duration: 2000,
	},
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const asyncHandler = async <T>(
	fn: () => Promise<T>,
	title: string,
	options: AsyncHandlerOptions<T> = {},
): Promise<T> => {
	const mergedOptions = { ...defaultOptions, ...options };
	const { onError, onSuccess, isLog, showToast, toastOptions, retry } = mergedOptions;

	let lastError: Error | null = null;
	let attempts = retry?.attempts || 1;

	while (attempts > 0) {
		try {
			const result = await fn();

			if (onSuccess) {
				onSuccess(result);
			}

			return result;
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			if (attempts > 1 && retry) {
				attempts--;
				await sleep(retry.delay);
				continue;
			}

			if (onError && error instanceof Error) {
				onError(error);
			}

			if (showToast) {
				toaster.create({
					title,
					description: lastError.message,
					type: 'error',
					duration: toastOptions?.duration || defaultOptions.toastOptions.duration,
				});
			}

			if (isLog) {
				console.error(error);
			}

			throw lastError;
		}
	}

	throw lastError;
};
