import { defineConfig } from 'eslint-define-config';
import reactPlugin from 'eslint-plugin-react';

export default defineConfig([
  {
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
      },
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: reactPlugin,
    },
    rules: {
      // 你的规则
    },
  },
  {
    ignores: ['node_modules/**', 'dist/**'],
  },
]);
