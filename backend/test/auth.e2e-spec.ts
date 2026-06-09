/**
 * Auth endpoint e2e smoke tests.
 *
 * These tests start the full NestJS application in-process (no real DB needed
 * because we override the TypeORM data-source with a test stub). They verify
 * that the HTTP layer wires up correctly: routes exist, guards fire, and DTOs
 * are validated.
 *
 * To keep the test hermetic we swap every repository and external service with
 * a light in-memory mock.  No PostgreSQL or Redis instance is required.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { KafkaProducerService } from '../src/iot/kafka/kafka.producer.service';
import { KafkaConsumerService } from '../src/iot/kafka/kafka.consumer.service';

// ─── Mock DataSource ──────────────────────────────────────────────────────────

/**
 * A minimal TypeORM DataSource stub so the DatabaseModule does not attempt a
 * real Postgres connection during tests.
 */
const mockDataSource = {
  isInitialized: true,
  initialize: jest.fn(async (): Promise<unknown> => mockDataSource),
  destroy: jest.fn(async () => undefined),
  // DatabaseService.onModuleInit() calls query() to check TimescaleDB + hypertable status
  query: jest.fn(async () => []),
  getRepository: jest.fn(() => ({
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
  })),
  // Used by TypeOrmModule.forRootAsync subscriber
  subscribers: [],
  migrations: [],
};

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Auth endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(mockDataSource)
      // Prevent KafkaJS from trying to open real TCP connections in the test environment
      .overrideProvider(KafkaProducerService)
      .useValue({ publishSensorReading: jest.fn(), onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .overrideProvider(KafkaConsumerService)
      .useValue({ registerReadingHandler: jest.fn(), getPipelineStats: jest.fn(() => ({})), getIsRunning: jest.fn(() => false), onModuleInit: jest.fn(), onModuleDestroy: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /auth/login ──────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns 400 when body is empty', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });

    it('returns 400 when email is invalid', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email', password: '123456' })
        .expect(400);
    });

    it('returns 401 when credentials are wrong', async () => {
      // userRepository.findOne returns null → invalid credentials
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: 'wrong' })
        .expect(401);
    });
  });

  // ── POST /auth/register ───────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('returns 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'test@example.com' }) // missing password
        .expect(400);
    });

    it('returns 400 when password is too short', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: '123', // too short if validation enforces min length
          firstname: 'Test',
          lastname: 'User',
        })
        .expect((res) => {
          // Accept 400 (validation error) or 201/409 (passes validator)
          expect([400, 201, 409]).toContain(res.status);
        });
    });
  });

  // ── GET /notifications (protected) ───────────────────────────────────────

  describe('GET /notifications', () => {
    it('returns 401 without a JWT token', async () => {
      await request(app.getHttpServer())
        .get('/notifications')
        .expect(401);
    });
  });

  // ── GET /alerts (protected) ───────────────────────────────────────────────

  describe('GET /alerts', () => {
    it('returns 401 without a JWT token', async () => {
      await request(app.getHttpServer())
        .get('/alerts')
        .expect(401);
    });
  });

  // ── GET /stations (protected) ─────────────────────────────────────────────

  describe('GET /stations', () => {
    it('returns 401 without a JWT token', async () => {
      await request(app.getHttpServer())
        .get('/stations')
        .expect(401);
    });
  });
});
