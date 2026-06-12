/** @type {import('ts-jest').JestConfigWithTsJest} */
// Tests d'intégration — aucune infrastructure externe requise
// Lancement : npx jest --config jest.integration.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/test/integration/**/*.integration-spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testEnvironment: 'node',
  testTimeout: 30_000,
  verbose: false,
  slowTestThreshold: 120,
  forceExit: true,
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^@nestjs/cache-manager$': '<rootDir>/test/__mocks__/@nestjs/cache-manager.js',
  },
};
