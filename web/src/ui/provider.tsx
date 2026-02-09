import { MantineProvider, localStorageColorSchemeManager } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';

import { appTheme } from './theme';

import type { PropsWithChildren } from 'react';


const colorSchemeManager = localStorageColorSchemeManager({
	key: 'talespinner-color-scheme',
});

export function Provider({ children }: PropsWithChildren) {
	return (
		<MantineProvider theme={appTheme} defaultColorScheme="auto" colorSchemeManager={colorSchemeManager}>
			<ModalsProvider>
				<Notifications zIndex={4000} position="top-right" />
				{children}
			</ModalsProvider>
		</MantineProvider>
	);
}

