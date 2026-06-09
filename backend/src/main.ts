import { ValidationPipe, Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // CORS configuration
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // API versioning (optional)
  app.setGlobalPrefix('api');

  // Swagger / OpenAPI
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AquaFlow API')
    .setDescription('Industrial water-station supervision platform — REST API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addTag('auth', 'Authentication & session management')
    .addTag('stations', 'Water station CRUD & status')
    .addTag('sensors', 'Sensor CRUD, readings & history')
    .addTag('alerts', 'Alert lifecycle management')
    .addTag('maintenance', 'Maintenance work-order tracking')
    .addTag('flows', 'Workflow automation engine')
    .addTag('analytics', 'Aggregated metrics & time-series')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Listen
  const port = process.env.PORT ? Number(process.env.PORT) : 3001;
  await app.listen(port);

  logger.log(`AquaFlow API listening on port ${port}`);
  logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
