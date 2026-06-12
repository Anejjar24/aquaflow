/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  // Unit tests only — E2E tests require live infrastructure (Postgres, Kafka, Redis)
  // Run E2E separately with: npx jest --config jest.e2e.config.js
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.module.ts', '!src/main.ts'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  // Suppress NestJS Logger output during test runs (error logs from error-handling tests)
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Raise slow-test threshold so timing never appears in red (ts-jest compile time is expected)
  slowTestThreshold: 120,
};
