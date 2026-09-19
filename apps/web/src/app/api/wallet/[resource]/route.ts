import { apiOrigin } from '../../../../lib/auth-server';

const headers = {
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'Content-Type': 'application/json',
};

/** Read-only bridge. No payment/credit/debit proxy exists in this phase. */
export async function GET(
  request: Request,
  context: { params: Promise<{ resource: string }> },
) {
  const { resource } = await context.params;
  if (!['balances', 'transactions'].includes(resource))
    return Response.json({ message: 'Not found' }, { status: 404, headers });
  try {
    const upstream = await fetch(
      `${apiOrigin()}/wallet/${resource}${new URL(request.url).search}`,
      {
        headers: {
          cookie: (request.headers.get('cookie') ?? '')
            .split(';')
            .map((part) => part.trim())
            .filter((part) => /^(?:__Host-box_session|box_session)=/.test(part))
            .join('; '),
        },
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      },
    );
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers,
    });
  } catch {
    return Response.json(
      { message: 'Wallet service unavailable' },
      { status: 503, headers },
    );
  }
}
