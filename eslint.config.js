import js from '@eslint/js';
import globals from 'globals';

// Flat-config ESLint setup. Auto-run by scripts/watch.js on every file change.
export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      eqeqeq: ['warn', 'always'],
    },
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
];
