import { z } from 'zod';

const port = z.coerce.number().int().min(1).max(65535);
const connectionUrl = (protocols: string[]) =>
  z
    .string()
    .url()
    .refine(
      (value) =>
        URL.canParse(value) && protocols.includes(new URL(value).protocol),
      'Unsupported connection protocol',
    );
const common = {
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
};
const redisUrl = connectionUrl(['redis:', 'rediss:']).refine((value) => {
  if (!URL.canParse(value)) return false;
  const db = new URL(value).pathname.slice(1);
  return db === '' || /^\d+$/.test(db);
}, 'Redis database must be a non-negative integer');
export const frontendEnvSchema = z.object(common);
export const apiEnvSchema = z.object({
  ...common,
  DATABASE_URL: connectionUrl(['postgres:', 'postgresql:']),
  REDIS_URL: redisUrl,
  API_HOST: z.string().min(1).default('0.0.0.0'),
  API_PORT: port.default(3002),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3001')
    .transform((value) => value.split(',').map((origin) => origin.trim()))
    .pipe(z.array(z.string().url()).min(1)),
});
export const workerEnvSchema = z.object({
  ...common,
  REDIS_URL: redisUrl,
  WORKER_HOST: z.string().min(1).default('0.0.0.0'),
  WORKER_PORT: port.default(3003),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(100).default(4),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;

export function parseEnv<T>(
  schema: z.ZodType<T>,
  input: Record<string, unknown>,
): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Do not include values or full Zod errors: connection strings can contain secrets.
    throw new Error(
      'Invalid environment variables: ' +
        [
          ...new Set(result.error.issues.map((issue) => issue.path.join('.'))),
        ].join(', '),
    );
  }
  return result.data;
}

export function redisConnection(url: string) {
  const parsed = new URL(redisUrl.parse(url));
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: decodeURIComponent(parsed.username) || undefined,
    password: decodeURIComponent(parsed.password) || undefined,
    db: Number(parsed.pathname.slice(1) || 0),
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
