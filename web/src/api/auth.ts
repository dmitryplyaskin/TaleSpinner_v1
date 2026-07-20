import { BASE_URL } from '../const';

import { authFetch, setAuthCsrfToken } from './auth-fetch';

export type AccessMode = 'local' | 'public';

export type AuthUser = {
	id: string;
	username: string;
	displayName: string;
	role: 'admin' | 'user';
	status: 'active' | 'disabled';
	hasPassword: boolean;
};

export type AuthStatus = {
	mode: AccessMode;
	setupRequired: boolean;
	authenticated: boolean;
	user: AuthUser | null;
	accounts: AuthUser[];
	csrfToken?: string;
};

type AuthResult = {
	user: AuthUser;
	csrfToken: string;
	expiresAt: string;
};

async function authJson<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await authFetch(`${BASE_URL}/auth${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers ?? {}),
		},
	});
	const body = (await response.json().catch(() => ({}))) as {
		data?: T;
		error?: { message?: string };
	};
	if (!response.ok) {
		throw new Error(body.error?.message ?? `HTTP error ${response.status}`);
	}
	return body.data as T;
}

export async function getAuthStatus(): Promise<AuthStatus> {
	const status = await authJson<AuthStatus>('/status');
	setAuthCsrfToken(status.csrfToken ?? null);
	return status;
}

export async function setupAccount(params: {
	username: string;
	displayName?: string;
	password: string;
	setupToken?: string;
}): Promise<AuthResult> {
	const result = await authJson<AuthResult>('/setup', {
		method: 'POST',
		headers: params.setupToken ? { 'X-Setup-Token': params.setupToken } : undefined,
		body: JSON.stringify({
			username: params.username,
			displayName: params.displayName,
			password: params.password,
		}),
	});
	setAuthCsrfToken(result.csrfToken);
	return result;
}

export async function loginAccount(params: {
	username?: string;
	userId?: string;
	password: string;
}): Promise<AuthResult> {
	const result = await authJson<AuthResult>('/login', {
		method: 'POST',
		body: JSON.stringify(params),
	});
	setAuthCsrfToken(result.csrfToken);
	return result;
}

export async function logoutAccount(): Promise<void> {
	await authJson<{ ok: true }>('/logout', { method: 'POST' });
	setAuthCsrfToken(null);
}

export async function listAuthUsers(): Promise<AuthUser[]> {
	return authJson<AuthUser[]>('/users');
}

export async function createAuthUser(params: {
	username: string;
	displayName?: string;
	password: string;
	role: 'admin' | 'user';
}): Promise<AuthUser> {
	return authJson<AuthUser>('/users', {
		method: 'POST',
		body: JSON.stringify(params),
	});
}
