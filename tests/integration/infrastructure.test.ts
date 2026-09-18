import { expect, it } from 'vitest';
import { Queue, QueueEvents } from 'bullmq';
import {
  apiEnvSchema,
  workerEnvSchema,
  parseEnv,
  redisConnection,
} from '@box/validation';
import { INFRASTRUCTURE_QUEUE, HEALTHCHECK_JOB } from '@box/types';
import { createApp } from '../../apps/api/src/app.js';
import { startWorker } from '../../apps/worker/src/app.js';

it('connects Prisma to PostgreSQL and completes a real BullMQ job', async () => {
  const apiEnv = parseEnv(apiEnvSchema, {
    ...process.env,
    LOG_LEVEL: 'silent',
  });
  const workerEnv = parseEnv(workerEnvSchema, {
    ...process.env,
    LOG_LEVEL: 'silent',
    WORKER_PORT: '13003',
  });
  const app = await createApp(apiEnv);
  const runtime = await startWorker(workerEnv);
  const connection = redisConnection(workerEnv.REDIS_URL);
  const queue = new Queue(INFRASTRUCTURE_QUEUE, { connection });
  const events = new QueueEvents(INFRASTRUCTURE_QUEUE, { connection });
  try {
    await app.getHttpAdapter().getInstance().ready();
    expect(
      (await app.inject({ method: 'GET', url: '/health/ready' })).statusCode,
    ).toBe(200);
    await events.waitUntilReady();
    await runtime.worker.waitUntilReady();
    expect(
      (await runtime.server.inject({ method: 'GET', url: '/health/ready' }))
        .statusCode,
    ).toBe(200);
    const job = await queue.add(
      HEALTHCHECK_JOB,
      {},
      { removeOnComplete: true, removeOnFail: 10 },
    );
    await expect(job.waitUntilFinished(events, 10000)).resolves.toEqual({
      status: 'ok',
    });
  } finally {
    await events.close();
    await queue.close();
    await runtime.close();
    await app.close();
  }
});
