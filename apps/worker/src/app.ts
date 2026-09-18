import { Worker } from 'bullmq';
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import { INFRASTRUCTURE_QUEUE, type HealthResponse } from '@box/types';
import { createLogger } from '@box/logger';
import { redisConnection, type WorkerEnv } from '@box/validation';
import { processInfrastructureJob } from './processor.js';

export async function startWorker(env: WorkerEnv) {
  const logger: FastifyBaseLogger = createLogger('worker', env.LOG_LEVEL);
  const worker = new Worker(INFRASTRUCTURE_QUEUE, processInfrastructureJob, {
    connection: {
      ...redisConnection(env.REDIS_URL),
      maxRetriesPerRequest: null,
      connectTimeout: 2000,
    },
    concurrency: env.WORKER_CONCURRENCY,
    autorun: false,
  });
  worker.on('error', (err) => logger.error({ err }, 'Worker connection error'));
  worker.on('failed', (job, err) =>
    logger.error({ err, jobId: job?.id }, 'Job failed'),
  );
  worker.on('completed', (job) =>
    logger.info({ jobId: job.id }, 'Job completed'),
  );

  const server: FastifyInstance = Fastify({ loggerInstance: logger });
  let stopping = false;
  let failed = false;
  let redisClient: Awaited<typeof worker.client> | undefined;
  void worker.client
    .then((client) => {
      redisClient = client;
    })
    .catch(() => {
      failed = true;
    });
  server.get('/health', (): HealthResponse => ({
    status: 'ok',
    service: 'worker',
  }));
  server.get('/health/ready', async (_request, reply) => {
    // A disconnected client must return 503 immediately, not enqueue an endless Redis command.
    const ready =
      !stopping &&
      !failed &&
      worker.isRunning() &&
      redisClient?.status === 'ready';
    return reply.code(ready ? 200 : 503).send({
      status: ready ? 'ok' : 'error',
      service: 'worker',
      checks: { redis: ready ? 'up' : 'down' },
    } satisfies HealthResponse);
  });
  void worker.run().catch((err: unknown) => {
    failed = true;
    logger.error({ err }, 'Worker stopped unexpectedly');
  });
  try {
    await server.listen({ port: env.WORKER_PORT, host: env.WORKER_HOST });
  } catch (error) {
    await worker.close(true);
    throw error;
  }

  return {
    worker,
    server,
    async close() {
      if (stopping) return;
      stopping = true;
      await server.close();
      await worker.close();
      logger.info('Worker shutdown complete');
    },
  };
}
