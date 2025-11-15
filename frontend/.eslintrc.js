/** @type {import('eslint').Linter.FlatConfig[]} */
module.exports = {
  root: true,
  extends: ['next/core-web-vitals'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
    project: './tsconfig.json'
  },
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    // Example stricter rules you can enable later
    // '@typescript-eslint/explicit-module-boundary-types': 'off'
  }
};
