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
  verbose: true,
  slowTestThreshold: 120,
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    // Replace @nestjs/cache-manager with a lightweight stub so NestJS never
    // calls loadPackage('cache-manager'), which fails in the Jest environment.
    // The stub registers CACHE_MANAGER globally so all modules can inject it.
    '^@nestjs/cache-manager$': '<rootDir>/test/__mocks__/@nestjs/cache-manager.js',
  },
};
