import type { HealthResponse } from '@box/types';
export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(
    { status: 'ok', service: 'web' } satisfies HealthResponse,
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
