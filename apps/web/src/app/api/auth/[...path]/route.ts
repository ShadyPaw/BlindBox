import { apiOrigin } from '../../../../lib/auth-server';

const reads = new Set(['me', 'admin/session']);
const writes = new Set([
  'register',
  'login',
  'logout',
  'forgot-password',
  'reset-password',
]);
async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const action = (await context.params).path.join('/');
  const writing = request.method === 'POST';
  if (!(writing ? writes : reads).has(action))
    return Response.json({ message: 'Not found' }, { status: 404 });
  const origin = request.headers.get('origin');
  // Standalone Next may use its bind address in request.url. The browser-facing
  // Host is the same-origin authority; deployments can pin it with WEB_ORIGIN.
  const expectedOrigin =
    process.env.WEB_ORIGIN ??
    `${new URL(request.url).protocol}//${request.headers.get('host')}`;
  if (
    writing &&
    (origin !== expectedOrigin ||
      request.headers.get('x-box-csrf') !== '1' ||
      !request.headers.get('content-type')?.startsWith('application/json'))
  )
    return Response.json({ message: '不允許此請求來源' }, { status: 403 });
  let body: string | undefined;
  if (writing) {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        length += result.value.byteLength;
        if (length > 16384) {
          await reader.cancel();
          return Response.json({ message: '請求內容過長' }, { status: 413 });
        }
        chunks.push(result.value);
      }
    }
    body = Buffer.concat(chunks).toString('utf8');
  }
  try {
    const upstream = await fetch(`${apiOrigin()}/auth/${action}`, {
      method: request.method,
      headers: {
        cookie: (request.headers.get('cookie') ?? '')
          .split(';')
          .map((part) => part.trim())
          .filter((part) => /^(?:__Host-box_session|box_session)=/.test(part))
          .join('; '),
        ...(writing
          ? {
              origin: origin!,
              'content-type': 'application/json',
              'x-box-csrf': '1',
            }
          : {}),
      },
      ...(body === undefined ? {} : { body }),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    const headers = new Headers({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
    });
    for (const cookie of upstream.headers.getSetCookie())
      headers.append('Set-Cookie', cookie);
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers,
    });
  } catch {
    return Response.json(
      { message: '帳戶服務暫時不可用，請稍後重試' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
