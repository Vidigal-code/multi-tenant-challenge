const js = require('@eslint/js');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        // Node.js globals (for Next.js)
        process: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        // React globals
        React: 'readonly',
        JSX: 'readonly',
      },
    },
    rules: {
      // Disable no-undef since TypeScript handles this
      'no-undef': 'off',
      // Allow unused vars starting with underscore
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'build/**',
      '*.js',
      'eslint.config.js',
      'next.config.js',
      'jest.config.ts',
    ],
  },
];
