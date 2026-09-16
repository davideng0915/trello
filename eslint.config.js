import js from '@eslint/js'

const browserGlobals = {
  console: 'readonly',
  document: 'readonly',
  fetch: 'readonly',
  File: 'readonly',
  window: 'readonly',
}

const nodeGlobals = {
  console: 'readonly',
  process: 'readonly',
}

export default [
  {
    ignores: ['dist/**', 'server/node_modules/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: browserGlobals,
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
    },
  },
  {
    files: ['server/**/*.js'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', ignoreRestSiblings: true }],
    },
  },
]