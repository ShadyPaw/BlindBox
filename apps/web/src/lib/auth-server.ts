import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { AuthUser } from '@box/types';

export function apiOrigin() {
  const url = new URL(process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3002');
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Invalid API_INTERNAL_URL');
  return url.origin;
}
export async function requireUser(): Promise<AuthUser> {
  const cookieStore = await cookies();
  const cookie = cookieStore
    .getAll()
    .filter((c) => ['box_session', '__Host-box_session'].includes(c.name))
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  if (!cookie) redirect('/?login=1');
  const response = await fetch(`${apiOrigin()}/auth/me`, {
    headers: { cookie },
    cache: 'no-store',
    signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) redirect('/?login=1');
  if (!response.ok) throw new Error('Account service unavailable');
  return ((await response.json()) as { user: AuthUser }).user;
}
