export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { parseEnv, frontendEnvSchema } = await import('@box/validation');
    const { createLogger } = await import('@box/logger');
    const env = parseEnv(frontendEnvSchema, process.env);
    createLogger('admin', env.LOG_LEVEL).info('Application initialized');
  }
}
