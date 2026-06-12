/**
 * Mock for @nestjs/cache-manager used in e2e tests.
 * Replaces the real module so NestJS never calls loadPackage('cache-manager'),
 * which would fail because cache-manager v5 has incompatible exports in this context.
 */

const CACHE_MANAGER = 'CACHE_MANAGER';

const mockCacheManager = {
  get: jest.fn(async () => undefined),
  set: jest.fn(async () => undefined),
  del: jest.fn(async () => undefined),
  reset: jest.fn(async () => undefined),
};

class MockCacheModule {
  static register() {
    return {
      module: MockCacheModule,
      providers: [{ provide: CACHE_MANAGER, useValue: mockCacheManager }],
      exports: [CACHE_MANAGER],
      global: true,
    };
  }

  static registerAsync(_options) {
    // Ignore factory options — return a synchronous global stub.
    // isGlobal: true is respected so all modules can inject CACHE_MANAGER.
    return {
      module: MockCacheModule,
      providers: [{ provide: CACHE_MANAGER, useValue: mockCacheManager }],
      exports: [CACHE_MANAGER],
      global: true,
    };
  }
}

module.exports = {
  CacheModule: MockCacheModule,
  CACHE_MANAGER,
  CacheInterceptor: jest.fn(),
  Cache: jest.fn(),
};
