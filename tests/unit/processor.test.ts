import { expect, it } from 'vitest';
import { processInfrastructureJob } from '../../apps/worker/src/processor.js';
it('processes an infrastructure probe', async () => {
  await expect(
    processInfrastructureJob({ name: 'healthcheck' }),
  ).resolves.toEqual({ status: 'ok' });
});
it('rejects unknown jobs instead of silently completing them', async () => {
  await expect(processInfrastructureJob({ name: 'unknown' })).rejects.toThrow(
    'Unsupported infrastructure job',
  );
});
