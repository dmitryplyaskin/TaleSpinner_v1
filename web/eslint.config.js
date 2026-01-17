import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
	{ ignores: ['dist'] },
	js.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ['**/*.{ts,tsx}'],
		languageOptions: {
			ecmaVersion: 2022,
			globals: globals.browser,
			sourceType: 'module',
		},
		plugins: {
			'react-hooks': reactHooks,
			'react-refresh': reactRefresh,
			import: importPlugin,
		},
		settings: {
			'import/resolver': {
				typescript: {},
			},
		},
		rules: {
			...reactHooks.configs.recommended.rules,

			// The plugin includes some very opinionated React Compiler rules.
			// Keep the classic rules, disable the noisy ones for now.
			'react-hooks/set-state-in-effect': 'off',
			'react-hooks/refs': 'off',
			'react-hooks/incompatible-library': 'off',

			// HMR safety
			'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

			// Imports hygiene
			'import/no-duplicates': 'error',
			'import/newline-after-import': 'error',
			'import/order': [
				'error',
				{
					groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
					'newlines-between': 'always',
					alphabetize: { order: 'asc', caseInsensitive: true },
				},
			],

			// Practical correctness
			eqeqeq: ['error', 'always'],
			'no-debugger': 'error',
			'no-console': ['warn', { allow: ['warn', 'error'] }],

			// TS defaults tweaks
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
			'@typescript-eslint/no-empty-object-type': [
				'error',
				{
					allowInterfaces: 'with-single-extends',
					allowObjectTypes: 'never',
					allowWithName: '^Props$',
				},
			],
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/consistent-type-imports': [
				'warn',
				{ prefer: 'type-imports', fixStyle: 'inline-type-imports' },
			],
		},
	},
);
