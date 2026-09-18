import type { AuthUser } from '@box/types';

export async function authRequest<T = { user: AuthUser }>(
  action: string,
  body?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`/api/auth/${action}`, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body
      ? {
          headers: { 'Content-Type': 'application/json', 'X-Box-CSRF': '1' },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.message === 'string'
        ? data.message
        : '帳戶服務暫時不可用，請稍後重試',
    );
  return data as T;
}
