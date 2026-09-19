import { z } from 'zod';
export {
  walletPostingSchema,
  walletTransactionsQuerySchema,
  type WalletPosting,
  type WalletTransactionsQuery,
} from './wallet.js';
export {
  catalogQuerySchema,
  catalogDetailQuerySchema,
  type CatalogQuery,
} from './catalog.js';

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
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  AUTH_SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  AUTH_COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  MAIL_TRANSPORT: z.enum(['disabled', 'file', 'smtp']).default('disabled'),
  MAIL_DIRECTORY: z.string().default('../../.local/mail'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: port.default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().email().default('no-reply@example.com'),
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

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(15).max(128);
export const registerSchema = z
  .object({ email: emailSchema, password: passwordSchema })
  .strict();
export const loginSchema = z
  .object({ email: emailSchema, password: z.string().min(1).max(128) })
  .strict();
export const forgotPasswordSchema = z.object({ email: emailSchema }).strict();
export const resetPasswordSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    password: passwordSchema,
  })
  .strict();

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
