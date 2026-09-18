import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { ServiceUnavailableException } from '@nestjs/common';

export const newToken = () => randomBytes(32).toString('hex');
export const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
let activeHashes = 0;
async function derive(password: string, salt: string): Promise<Buffer> {
  if (activeHashes >= 2) throw new ServiceUnavailableException('請稍後重試');
  activeHashes++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        salt,
        64,
        { N: 131072, r: 8, p: 1, maxmem: 192 * 1024 * 1024 },
        (error, key) => (error ? reject(error) : resolve(key)),
      );
    });
  } finally {
    activeHashes--;
  }
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$131072$8$1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
const dummyHash = `scrypt$131072$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
export async function verifyPassword(password: string, hash = dummyHash) {
  const match = /^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(
    hash,
  );
  const actual = await derive(password, match?.[1] ?? '0'.repeat(32));
  const expected = Buffer.from(match?.[2] ?? '0'.repeat(128), 'hex');
  return timingSafeEqual(actual, expected) && !!match && hash !== dummyHash;
}
