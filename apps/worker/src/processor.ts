import { HEALTHCHECK_JOB } from '@box/types';
import { UnrecoverableError } from 'bullmq';

export async function processInfrastructureJob(job: { name: string }) {
  if (job.name !== HEALTHCHECK_JOB) {
    throw new UnrecoverableError('Unsupported infrastructure job');
  }
  return { status: 'ok' as const };
}
