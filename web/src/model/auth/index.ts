import { combine, createEffect, createEvent, createStore, sample } from 'effector';

import {
	changeOwnPassword,
	createAuthUser,
	getAuthStatus,
	loginAccount,
	listAuthUsers,
	logoutAccount,
	registerAccount,
	resetAuthUserPassword,
	setupAccount,
	switchAccount,
	updateAuthUser,
	type AuthStatus,
} from '../../api/auth';

export const authStarted = createEvent();
export const authRetryRequested = createEvent();
export const setupSubmitted = createEvent<Parameters<typeof setupAccount>[0]>();
export const loginSubmitted = createEvent<Parameters<typeof loginAccount>[0]>();
export const registerSubmitted = createEvent<Parameters<typeof registerAccount>[0]>();
export const switchAccountSubmitted = createEvent<Parameters<typeof switchAccount>[0]>();
export const logoutRequested = createEvent();
export const accountManagerOpened = createEvent();
export const createUserSubmitted = createEvent<Parameters<typeof createAuthUser>[0]>();
export const userAdministrationSubmitted = createEvent<Parameters<typeof updateAuthUser>[0]>();
export const userPasswordResetSubmitted = createEvent<Parameters<typeof resetAuthUserPassword>[0]>();
export const ownPasswordChangeSubmitted = createEvent<Parameters<typeof changeOwnPassword>[0]>();

export const loadAuthStatusFx = createEffect(getAuthStatus);
export const setupAccountFx = createEffect(setupAccount);
export const loginAccountFx = createEffect(loginAccount);
export const registerAccountFx = createEffect(registerAccount);
export const switchAccountFx = createEffect(switchAccount);
export const logoutAccountFx = createEffect(logoutAccount);
export const loadAuthUsersFx = createEffect(listAuthUsers);
export const createAuthUserFx = createEffect(createAuthUser);
export const updateAuthUserFx = createEffect(updateAuthUser);
export const resetAuthUserPasswordFx = createEffect(resetAuthUserPassword);
export const changeOwnPasswordFx = createEffect(changeOwnPassword);

const defaultStatus: AuthStatus = {
	mode: 'local',
	registrationAllowed: true,
	setupRequired: false,
	authenticated: false,
	user: null,
	accounts: [],
};

export const $authStatus = createStore<AuthStatus>(defaultStatus)
	.on(loadAuthStatusFx.doneData, (_, status) => status)
	.on(setupAccountFx.doneData, (state, result) => ({
		...state,
		setupRequired: false,
		authenticated: true,
		user: result.user,
		accounts: [],
		csrfToken: result.csrfToken,
	}))
	.on(loginAccountFx.doneData, (state, result) => ({
		...state,
		authenticated: true,
		user: result.user,
		accounts: [],
		csrfToken: result.csrfToken,
	}))
	.on(registerAccountFx.doneData, (state, result) => ({
		...state,
		setupRequired: false,
		authenticated: true,
		user: result.user,
		accounts: [],
		csrfToken: result.csrfToken,
	}))
	.on(switchAccountFx.doneData, (state, result) => ({
		...state,
		authenticated: true,
		user: result.user,
		accounts: [],
		csrfToken: result.csrfToken,
	}))
	.on(changeOwnPasswordFx.doneData, (state, result) => ({
		...state,
		authenticated: true,
		user: result.user,
		csrfToken: result.csrfToken,
	}));

export const $authInitialized = createStore(false)
	.on(authStarted, () => false)
	.on([loadAuthStatusFx.done, loadAuthStatusFx.fail], () => true);

export const $authError = createStore<string | null>(null)
	.on(
		[
			loadAuthStatusFx.failData,
			setupAccountFx.failData,
			loginAccountFx.failData,
			registerAccountFx.failData,
			switchAccountFx.failData,
			logoutAccountFx.failData,
			createAuthUserFx.failData,
			updateAuthUserFx.failData,
			resetAuthUserPasswordFx.failData,
			changeOwnPasswordFx.failData,
		],
		(_, error) => (error instanceof Error ? error.message : String(error)),
	)
	.reset(
		authRetryRequested,
		setupSubmitted,
		loginSubmitted,
		registerSubmitted,
		switchAccountSubmitted,
		logoutRequested,
		createUserSubmitted,
		userAdministrationSubmitted,
		userPasswordResetSubmitted,
		ownPasswordChangeSubmitted,
	);

export const $authPending = combine(
	[
		loadAuthStatusFx.pending,
		setupAccountFx.pending,
		loginAccountFx.pending,
		registerAccountFx.pending,
		switchAccountFx.pending,
		logoutAccountFx.pending,
	],
	(pendingStates) => pendingStates.some(Boolean),
);

export const $authUsers = createStore<Awaited<ReturnType<typeof listAuthUsers>>>([]).on(
	loadAuthUsersFx.doneData,
	(_, users) => users,
);

sample({ clock: [authStarted, authRetryRequested], target: loadAuthStatusFx });
sample({ clock: setupSubmitted, target: setupAccountFx });
sample({ clock: loginSubmitted, target: loginAccountFx });
sample({ clock: registerSubmitted, target: registerAccountFx });
sample({ clock: switchAccountSubmitted, target: switchAccountFx });
sample({ clock: logoutRequested, target: logoutAccountFx });
sample({ clock: accountManagerOpened, target: loadAuthUsersFx });
sample({ clock: createUserSubmitted, target: createAuthUserFx });
sample({ clock: userAdministrationSubmitted, target: updateAuthUserFx });
sample({ clock: userPasswordResetSubmitted, target: resetAuthUserPasswordFx });
sample({ clock: ownPasswordChangeSubmitted, target: changeOwnPasswordFx });
sample({
	clock: [createAuthUserFx.done, updateAuthUserFx.done, resetAuthUserPasswordFx.done],
	target: loadAuthUsersFx,
});
sample({
	clock: [setupAccountFx.done, loginAccountFx.done, registerAccountFx.done, createAuthUserFx.done],
	target: loadAuthStatusFx,
});

logoutAccountFx.done.watch(() => {
	if (typeof window !== 'undefined') window.location.reload();
});

switchAccountFx.done.watch(() => {
	if (typeof window !== 'undefined') window.location.reload();
});
