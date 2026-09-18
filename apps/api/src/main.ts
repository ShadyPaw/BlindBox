import { apiEnvSchema, parseEnv } from '@box/validation';
import { createLogger } from '@box/logger';
import { createApp } from './app.js';

try {
  const env = parseEnv(apiEnvSchema, process.env);
  const app = await createApp(env);
  await app.listen(env.API_PORT, env.API_HOST);
} catch (error) {
  createLogger('api').fatal({ err: error }, 'API startup failed');
  process.exit(1);
}
