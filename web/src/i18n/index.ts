import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './resources/en';
import ru from './resources/ru';

i18n.use(initReactI18next).init({
	resources: {
		ru,
		en,
	},
	lng: 'ru',
	fallbackLng: 'ru',
	interpolation: {
		escapeValue: false,
	},
	returnEmptyString: false,
});

export default i18n;
