import daStyle from 'eslint-config-dicodingacademy';
import pluginReact from 'eslint-plugin-react';

const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  HTMLMediaElement: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
  setTimeout: 'readonly',
};

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  daStyle,
  {
    files: ['**/*.{js,jsx}'],
    plugins: {
      react: pluginReact,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'camelcase': 'off',
      'no-console': 'off',
      'max-len': 'off',
    },
  },
];
