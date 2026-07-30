import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import App from './App.tsx';
import './i18n';
import './index.css';
import { AuthGate } from './features/auth/auth-gate.tsx';
import { Provider } from './ui/provider.tsx';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<Provider>
			<AuthGate>
				<App />
			</AuthGate>
		</Provider>
	</StrictMode>,
);
