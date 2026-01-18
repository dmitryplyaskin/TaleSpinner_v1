import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.tsx';
import './index.css';
import { appStarted } from './model/app-init.ts';
import { Provider } from './ui/chakra-core-ui/provider.tsx';

appStarted();

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<Provider>
			<App />
		</Provider>
	</StrictMode>,
);
