/** @type {import('ts-jest').JestConfigWithTsJest} */
// E2E tests — require live infrastructure (Postgres/TimescaleDB, Kafka, Redis, Mosquitto)
// Run with: docker-compose up -d && npx jest --config jest.e2e.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 60_000,
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
};
