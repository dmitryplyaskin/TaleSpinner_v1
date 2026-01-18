import { notifications } from '@mantine/notifications';

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

type ToastOptions = {
	title?: string;
	description?: string;
	type?: ToastType;
	duration?: number;
};

function mapColor(type: Exclude<ToastType, 'loading'>): string {
	switch (type) {
		case 'success':
			return 'green';
		case 'error':
			return 'red';
		case 'warning':
			return 'yellow';
		case 'info':
		default:
			return 'blue';
	}
}

function showToast({ title, description, type = 'info', duration }: ToastOptions) {
	const autoClose = typeof duration === 'number' ? duration : 2000;

	if (type === 'loading') {
		notifications.show({
			title,
			message: description,
			loading: true,
			autoClose,
			withCloseButton: true,
		});
		return;
	}

	notifications.show({
		title,
		message: description,
		color: mapColor(type),
		autoClose,
		withCloseButton: true,
	});
}

export const toaster = {
	success: (opts: Omit<ToastOptions, 'type'>) => showToast({ ...opts, type: 'success' }),
	error: (opts: Omit<ToastOptions, 'type'>) => showToast({ ...opts, type: 'error' }),
	warning: (opts: Omit<ToastOptions, 'type'>) => showToast({ ...opts, type: 'warning' }),
	info: (opts: Omit<ToastOptions, 'type'>) => showToast({ ...opts, type: 'info' }),
	create: (opts: ToastOptions) => showToast(opts),
};

