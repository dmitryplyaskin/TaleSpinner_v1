export type OperationFinishedFailure = {
	status: 'error' | 'aborted';
	name: string | null;
	hook: string | null;
	errorMessage: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
	return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function readOperationFinishedFailure(data: unknown): OperationFinishedFailure | null {
	if (!isRecord(data)) return null;
	const status = data.status;
	if (status !== 'error' && status !== 'aborted') return null;

	const error = isRecord(data.error) ? data.error : null;
	return {
		status,
		name: readNonEmptyString(data.name) ?? readNonEmptyString(data.opId),
		hook: readNonEmptyString(data.hook),
		errorMessage: error ? readNonEmptyString(error.message) : null,
	};
}
