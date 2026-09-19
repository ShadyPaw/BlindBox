import type { ApiEnv } from '@box/validation';

/** Shared cookie parsing keeps wallet reads on the same session boundary as auth routes. */
export function sessionToken(cookie: string | undefined, env: ApiEnv) {
  const name =
    env.NODE_ENV === 'production' || env.AUTH_COOKIE_SECURE
      ? '__Host-box_session'
      : 'box_session';
  const values = (cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (values.length !== 1) return undefined;
  const value = values[0]!.slice(name.length + 1);
  return /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}
