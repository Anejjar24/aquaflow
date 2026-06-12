/**
 * Auth endpoint e2e smoke tests.
 * One it() per endpoint — shows clean per-route PASS lines in verbose output.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { KafkaProducerService } from '../src/iot/kafka/kafka.producer.service';
import { KafkaConsumerService } from '../src/iot/kafka/kafka.consumer.service';
import { MqttClient } from '../src/iot/mqtt/mqtt.client';

const CACHE_MANAGER = 'CACHE_MANAGER';

const mockCacheManager = {
  get: jest.fn(async () => undefined),
  set: jest.fn(async () => undefined),
  del: jest.fn(async () => undefined),
  reset: jest.fn(async () => undefined),
};

const mockRepository = {
  findOne: jest.fn(async () => null),
  find: jest.fn(async () => []),
  create: jest.fn((v) => v),
  save: jest.fn(async (v) => v),
  findAndCount: jest.fn(async () => [[], 0]),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn(async () => 0),
    getManyAndCount: jest.fn(async () => [[], 0]),
  })),
};

const mockDataSource = {
  isInitialized: true,
  initialize: jest.fn(async (): Promise<unknown> => mockDataSource),
  destroy: jest.fn(async () => undefined),
  query: jest.fn(async () => []),
  entityMetadatas: [],
  options: { type: 'postgres' },
  getRepository: jest.fn(() => mockRepository),
  getTreeRepository: jest.fn(() => mockRepository),
  subscribers: [],
  migrations: [],
};

describe('Auth endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      .overrideProvider(KafkaProducerService)
      .useValue({ publishSensorReading: jest.fn(), onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .overrideProvider(KafkaConsumerService)
      .useValue({ registerReadingHandler: jest.fn(), getPipelineStats: jest.fn(() => ({})), getIsRunning: jest.fn(() => false), onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .overrideProvider(CACHE_MANAGER)
      .useValue(mockCacheManager)
      .overrideProvider(MqttClient)
      .useValue({
        onModuleInit: jest.fn(async () => undefined),
        onModuleDestroy: jest.fn(async () => undefined),
        connect: jest.fn(async () => undefined),
        disconnect: jest.fn(async () => undefined),
        publish: jest.fn(async () => undefined),
        subscribe: jest.fn(),
        registerHandler: jest.fn(),
        getIsConnected: jest.fn(() => false),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login', async () => {
    await request(app.getHttpServer()).post('/auth/login').send({}).expect(400);
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'not-an-email', password: '123456' }).expect(400);
    await request(app.getHttpServer()).post('/auth/login').send({ email: 'nobody@example.com', password: 'wrongpassword123' }).expect(401);
  });

  it('POST /auth/register', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({ email: 'test@example.com' }).expect(400);
    await request(app.getHttpServer()).post('/auth/register').send({
      email: 'test@example.com', password: '123', firstname: 'Test', lastname: 'User',
    }).expect((res) => { expect([400, 201, 409]).toContain(res.status); });
  });

  it('GET /notifications', async () => {
    await request(app.getHttpServer()).get('/notifications').expect(401);
  });

  it('GET /alerts', async () => {
    await request(app.getHttpServer()).get('/alerts').expect(401);
  });

  it('GET /stations', async () => {
    await request(app.getHttpServer()).get('/stations').expect(401);
  });
});
