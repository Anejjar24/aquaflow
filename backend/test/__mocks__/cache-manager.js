/**
 * Manual mock for cache-manager — used in e2e tests.
 * cache-manager v5 changed its module format; this stub allows
 * NestJS CacheModule to initialise without a real Redis/memory store.
 */

const store = {};

const mockCache = {
  get: jest.fn(async (key) => store[key] ?? undefined),
  set: jest.fn(async (key, value) => { store[key] = value; }),
  del: jest.fn(async (key) => { delete store[key]; }),
  reset: jest.fn(async () => { Object.keys(store).forEach(k => delete store[k]); }),
};

module.exports = {
  caching: jest.fn(async () => mockCache),
  createCache: jest.fn(async () => mockCache),
  memoryStore: jest.fn(() => ({})),
};
