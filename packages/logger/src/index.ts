import {
  pino,
  stdSerializers,
  type DestinationStream,
  type LoggerOptions,
} from 'pino';

export function createLogger(
  service: string,
  level = 'info',
  destination?: DestinationStream,
) {
  const options: LoggerOptions = {
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        'token',
        'DATABASE_URL',
        'REDIS_URL',
      ],
      censor: '[REDACTED]',
    },
    serializers: { err: stdSerializers.err },
  };
  return destination ? pino(options, destination) : pino(options);
}
