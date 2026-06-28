import js from '@eslint/js';
import globals from 'globals';

// Flat-config ESLint setup. Auto-run by scripts/watch.js on every file change.
// `ignores` lives in its own top-level config object so ESLint flat-config
// reliably excludes `dist/` (third-party bundles that we don't ship lint over)
// and `node_modules/` (vendor code).
export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
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
  },
];
