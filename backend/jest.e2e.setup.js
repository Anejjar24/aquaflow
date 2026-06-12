/**
 * E2E test setup — mocks third-party packages that cannot be loaded in the
 * Jest environment:
 *   • cache-manager        — v5 has a dynamic require that fails in Jest
 *   • cache-manager-redis-yet — requires a live Redis connection
 *
 * These mocks are registered BEFORE any test module is compiled so that
 * NestJS CacheModule.registerAsync() gets a working in-memory stub instead
 * of trying to open a real Redis socket.
 */

const mockCacheInstance = {
  get: jest.fn(async () => undefined),
  set: jest.fn(async () => undefined),
  del: jest.fn(async () => undefined),
  reset: jest.fn(async () => undefined),
};

jest.mock('cache-manager', () => ({
  caching: jest.fn(async () => mockCacheInstance),
  memoryStore: jest.fn(() => ({})),
  multiCaching: jest.fn(async () => mockCacheInstance),
}));

jest.mock('cache-manager-redis-yet', () => ({
  redisStore: jest.fn(async () => ({
    client: { quit: jest.fn() },
    get: jest.fn(async () => undefined),
    set: jest.fn(async () => undefined),
    del: jest.fn(async () => undefined),
    reset: jest.fn(async () => undefined),
  })),
}));
