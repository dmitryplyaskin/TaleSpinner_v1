let csrfToken: string | null = null;

export function setAuthCsrfToken(token: string | null): void {
	csrfToken = token;
}

function isMutation(method: string | undefined): boolean {
	const normalized = (method ?? 'GET').toUpperCase();
	return normalized !== 'GET' && normalized !== 'HEAD' && normalized !== 'OPTIONS';
}

export function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
	const headers = new Headers(init.headers);
	if (csrfToken && isMutation(init.method)) {
		headers.set('X-CSRF-Token', csrfToken);
	}
	return fetch(input, {
		...init,
		headers,
		credentials: 'include',
	});
}
