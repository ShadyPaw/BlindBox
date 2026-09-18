import { catalogQuerySchema } from '@box/validation';
import { apiOrigin } from '../../../../lib/auth-server';
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const entries = [...params];
  if (
    new Set(entries.map(([key]) => key)).size !== entries.length ||
    !catalogQuerySchema.safeParse(Object.fromEntries(entries)).success
  )
    return Response.json(
      { message: 'Invalid catalog filters' },
      { status: 400 },
    );
  try {
    const response = await fetch(`${apiOrigin()}/catalog/boxes?${params}`, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return Response.json(
      { message: 'Catalog service unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
