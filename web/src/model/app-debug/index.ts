import { createEvent, createStore } from 'effector';

const DEBUG_STORAGE_KEY = 'app_debug_enabled';
const LEGACY_DEBUG_STORAGE_KEY = 'chat_generation_debug';

function parseBool(raw: string | null): boolean | null {
	if (raw === '1' || raw === 'true') return true;
	if (raw === '0' || raw === 'false') return false;
	return null;
}

function readInitialDebugEnabled(): boolean {
	if (typeof window === 'undefined') return false;

	const runtimeFlag = (window as Window & { __chatGenerationDebug?: boolean }).__chatGenerationDebug;
	if (typeof runtimeFlag === 'boolean') return runtimeFlag;

	try {
		const saved = parseBool(window.localStorage.getItem(DEBUG_STORAGE_KEY));
		if (saved !== null) return saved;

		const legacy = parseBool(window.localStorage.getItem(LEGACY_DEBUG_STORAGE_KEY));
		if (legacy !== null) return legacy;
	} catch {
		// ignore storage access errors
	}

	return false;
}

function persistDebugEnabled(value: boolean): void {
	if (typeof window === 'undefined') return;

	try {
		const serialized = value ? '1' : '0';
		window.localStorage.setItem(DEBUG_STORAGE_KEY, serialized);
		window.localStorage.setItem(LEGACY_DEBUG_STORAGE_KEY, serialized);
	} catch {
		// ignore storage access errors
	}

	(window as Window & { __chatGenerationDebug?: boolean }).__chatGenerationDebug = value;
}

export const setAppDebugEnabled = createEvent<boolean>();
export const toggleAppDebugEnabled = createEvent();

export const $appDebugEnabled = createStore<boolean>(readInitialDebugEnabled())
	.on(setAppDebugEnabled, (_state, value) => value)
	.on(toggleAppDebugEnabled, (state) => !state);

$appDebugEnabled.watch((enabled) => {
	persistDebugEnabled(enabled);
});

export function isAppDebugEnabled(): boolean {
	return $appDebugEnabled.getState();
}
