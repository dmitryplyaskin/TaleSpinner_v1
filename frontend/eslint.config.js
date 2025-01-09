import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
	{ ignores: ['dist'] },
	{
		extends: [
			js.configs.recommended,
			...tseslint.configs.recommended,
			'plugin:import/recommended',
			'plugin:import/typescript',
		],
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
			sourceType: 'module', // Добавлено для работы с import/order
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
			import: importPlugin, // Добавлено для сортировки импортов
		},
		settings: {
			'import/resolver': {
				typescript: {}, // this loads <rootdir>/tsconfig.json to eslint
			},
		},
		rules: {
			...reactHooks.configs.recommended.rules,
			'react-refresh/only-export-components': [
				'warn',
				{ allowConstantExport: true },
			],
			'import/order': [
				'error',
				{
					groups: [
						'builtin',
						'external',
						'internal',
						'parent',
						'sibling',
						'index',
						'object',
						'type',
					],
					'newlines-between': 'always',
					alphabetize: {
						order: 'asc',
						caseInsensitive: true,
					},
				},
			],
			'no-unused-vars': 'warn',
			'no-console': 'warn',
			eqeqeq: ['error', 'always'],
			quotes: ['error', 'single'],
			semi: ['error', 'always'],
			indent: ['error', 2],
			'max-len': ['error', { code: 100 }], // Ограничение длины строки
			'object-curly-spacing': ['error', 'always'],
			'array-bracket-spacing': ['error', 'never'],
			'comma-dangle': ['error', 'always-multiline'],
			'no-multiple-empty-lines': ['error', { max: 1 }],
			'no-trailing-spaces': 'error',
			'@typescript-eslint/no-explicit-any': 'off', // Разрешить использование any
			'@typescript-eslint/no-unused-vars': 'warn', // Предупреждение о неиспользуемых переменных TypeScript
		},
	},
);
