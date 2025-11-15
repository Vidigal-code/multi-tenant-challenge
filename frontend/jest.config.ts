import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleFileExtensions: ['ts','tsx','js','jsx'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', module: 'commonjs' } }],
  },
  moduleNameMapper: {
    '^.+\\.(css|scss)$': 'identity-obj-proxy',
  },
  testMatch: ['<rootDir>/src/tests/**/*.(spec|test).ts?(x)'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/tests/pages/', '<rootDir>/src/tests/components/'],
  transformIgnorePatterns: ['/node_modules/'],
};

export default config;