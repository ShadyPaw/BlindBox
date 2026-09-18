import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import type { ApiEnv } from '@box/validation';

export interface ResetMailer {
  send(email: string, url: string): Promise<void>;
}
export function createMailer(env: ApiEnv): ResetMailer | undefined {
  if (env.MAIL_TRANSPORT === 'disabled') return undefined;
  if (env.MAIL_TRANSPORT === 'file') {
    if (env.NODE_ENV === 'production')
      throw new Error('File mail transport is forbidden in production');
    return {
      async send(email, url) {
        const directory = resolve(env.MAIL_DIRECTORY);
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await writeFile(
          resolve(directory, `${randomUUID()}.json`),
          JSON.stringify(
            { to: email, subject: 'BlindBox 密碼重設', url },
            null,
            2,
          ),
          { mode: 0o600, flag: 'wx' },
        );
      },
    };
  }
  if (!env.SMTP_HOST || !!env.SMTP_USER !== !!env.SMTP_PASSWORD)
    throw new Error('Invalid SMTP configuration');
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    requireTLS: !env.SMTP_SECURE,
    connectionTimeout: 5000,
    socketTimeout: 10000,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
  });
  return {
    async send(email, url) {
      await transport.sendMail({
        from: env.MAIL_FROM,
        to: email,
        subject: 'BlindBox 密碼重設',
        text: `請在 30 分鐘內開啟以下連結重設密碼：\n${url}\n\n如果不是您提出的申請，請忽略這封郵件。`,
      });
    },
  };
}
