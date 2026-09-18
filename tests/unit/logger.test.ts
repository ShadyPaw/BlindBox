import { expect, it } from 'vitest';
import { createLogger } from '@box/logger';
it('emits structured JSON with sensitive fields redacted', () => {
  let output = '';
  const logger = createLogger('test', 'info', {
    write: (chunk: string) => {
      output += chunk;
    },
  });
  logger.info(
    {
      password: 'hidden',
      req: { headers: { authorization: 'Bearer hidden', cookie: 'hidden' } },
    },
    'ready',
  );
  const entry = JSON.parse(output);
  expect(entry).toMatchObject({
    service: 'test',
    msg: 'ready',
    password: '[REDACTED]',
  });
  expect(entry.time).toEqual(expect.any(String));
  expect(output).not.toContain('hidden');
});
