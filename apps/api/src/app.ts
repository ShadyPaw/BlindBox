import 'reflect-metadata';
import {
  Controller,
  Get,
  Inject,
  Module,
  ServiceUnavailableException,
  type LoggerService,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { createDatabase } from '@box/database';
import { createLogger } from '@box/logger';
import { redisConnection, type ApiEnv } from '@box/validation';
import type { HealthResponse } from '@box/types';
import { Redis } from 'ioredis';
import { AuthController } from './auth/controller.js';
import { AuthService, redisLimiter, type AuthRuntime } from './auth/service.js';
import { createMailer } from './auth/mail.js';
import { CatalogQueryService } from './catalog/service.js';
import { CatalogController } from './catalog/controller.js';
import { WalletQueryService } from './wallet/query-service.js';
import { WalletController } from './wallet/controller.js';
import { WalletLedgerService } from './wallet/ledger-service.js';

export interface Dependencies {
  ledger?: WalletLedgerService;
  wallet?: WalletQueryService;
  catalog?: CatalogQueryService;
  auth?: AuthRuntime;
  database: () => Promise<unknown>;
  redis: () => Promise<unknown>;
  onModuleDestroy: () => Promise<void>;
}
export function createDependencies(env: ApiEnv): Dependencies {
  const database = createDatabase(env.DATABASE_URL);
  const redis = new Redis({
    ...redisConnection(env.REDIS_URL),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 2000,
  });
  const logger = createLogger('api', env.LOG_LEVEL);
  redis.on('error', () => logger.warn('Redis connection unavailable'));
  return {
    ledger: new WalletLedgerService(database),
    wallet: new WalletQueryService(database),
    catalog: new CatalogQueryService(database),
    auth: {
      service: new AuthService(database, env, createMailer(env)),
      limit: redisLimiter(redis),
    },
    database: () => database.$queryRaw`SELECT id FROM "User" LIMIT 1`,
    redis: () => redis.ping(),
    onModuleDestroy: async () => {
      redis.disconnect();
      await database.$disconnect();
    },
  };
}

@Controller('health')
class HealthController {
  constructor(
    @Inject('DEPENDENCIES') private readonly dependencies: Dependencies,
  ) {}
  @Get()
  live(): HealthResponse {
    return { status: 'ok', service: 'api' };
  }

  @Get('ready')
  async ready(): Promise<HealthResponse> {
    const results = await Promise.allSettled([
      this.dependencies.database(),
      this.dependencies.redis(),
    ]);
    const checks = {
      database: results[0]?.status === 'fulfilled' ? 'up' : 'down',
      redis: results[1]?.status === 'fulfilled' ? 'up' : 'down',
    } as const;
    if (Object.values(checks).includes('down')) {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'api',
        checks,
      });
    }
    return { status: 'ok', service: 'api', checks };
  }
}

export async function createApp(
  env: ApiEnv,
  dependencies = createDependencies(env),
): Promise<NestFastifyApplication> {
  const logger = createLogger('api', env.LOG_LEVEL);
  const nestLogger: LoggerService = {
    log: (message: unknown) =>
      logger.info({ context: 'Nest' }, String(message)),
    error: (message: unknown) =>
      logger.error({ context: 'Nest' }, String(message)),
    warn: (message: unknown) =>
      logger.warn({ context: 'Nest' }, String(message)),
    debug: (message: unknown) =>
      logger.debug({ context: 'Nest' }, String(message)),
    verbose: (message: unknown) =>
      logger.trace({ context: 'Nest' }, String(message)),
  };
  @Module({
    controllers: [
      HealthController,
      AuthController,
      CatalogController,
      WalletController,
    ],
    providers: [
      { provide: 'WALLET_LEDGER', useValue: dependencies.ledger ?? null },
      { provide: 'WALLET_QUERY', useValue: dependencies.wallet ?? null },
      { provide: 'CATALOG_SERVICE', useValue: dependencies.catalog ?? null },
      { provide: 'DEPENDENCIES', useValue: dependencies },
      { provide: 'AUTH_RUNTIME', useValue: dependencies.auth ?? null },
      { provide: 'API_ENV', useValue: env },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      loggerInstance: logger,
      bodyLimit: 1048576,
      requestTimeout: 30000,
    }),
    { logger: nestLogger },
  );
  app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (request, reply, payload) => {
      if (
        request.url.startsWith('/auth/') ||
        request.url.startsWith('/catalog/') ||
        request.url.startsWith('/wallet/')
      ) {
        reply.header('Cache-Control', 'no-store');
        reply.header('Referrer-Policy', 'no-referrer');
        reply.header('X-Content-Type-Options', 'nosniff');
      }
      return payload;
    });
  app.enableShutdownHooks();
  await app.init();
  return app;
}
