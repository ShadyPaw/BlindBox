export type ServiceName = 'web' | 'admin' | 'api' | 'worker';
export interface HealthResponse {
  status: 'ok' | 'error';
  service: ServiceName;
  checks?: Record<string, 'up' | 'down'>;
}
export const INFRASTRUCTURE_QUEUE = 'infrastructure';
export const HEALTHCHECK_JOB = 'healthcheck';
