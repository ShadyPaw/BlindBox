import { parseEnv, workerEnvSchema } from '@box/validation';
import { createLogger } from '@box/logger';
import { startWorker } from './app.js';

const logger = createLogger('worker');
try {
  const runtime = await startWorker(parseEnv(workerEnvSchema, process.env));
  let stopping = false;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      if (stopping) return;
      stopping = true;
      const deadline = setTimeout(() => {
        logger.error('Shutdown deadline exceeded');
        process.exit(1);
      }, 30000);
      deadline.unref();
      void runtime
        .close()
        .then(() => clearTimeout(deadline))
        .catch((err: unknown) => {
          logger.error({ err }, 'Shutdown failed');
          process.exit(1);
        });
    });
  }
} catch (err) {
  logger.fatal({ err }, 'Worker startup failed');
  process.exit(1);
}
