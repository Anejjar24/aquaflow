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
  collectCoverageFrom: [
    'src/**/*.ts',
    // Infrastructure / wiring — excluded from coverage gates
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.controller.ts',    // Controllers are HTTP adapters — tested via e2e
    '!src/**/*.guard.ts',
    '!src/**/*.filter.ts',
    '!src/**/*.interceptor.ts',
    '!src/**/*.middleware.ts',
    '!src/**/*.decorator.ts',
    '!src/database/migrations/**',
    '!src/database/seeds/**',
    '!src/realtime/**',           // WebSocket gateway — tested via e2e
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  // Threshold is enforced per-file in CI (see backend-ci.yml enforce step)
  // Global threshold kept low because controllers/guards are excluded from unit tests
  // and tested separately via e2e/integration tests.
  coverageThreshold: {
    global: {
      statements: 20,
      branches: 10,
      functions: 20,
      lines: 20,
    },
  },
  testEnvironment: 'node',
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  // Suppress NestJS Logger output during test runs (error logs from error-handling tests)
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Raise slow-test threshold so timing never appears in red (ts-jest compile time is expected)
  slowTestThreshold: 120,
};
