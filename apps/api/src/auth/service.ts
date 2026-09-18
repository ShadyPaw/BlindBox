import {
  BadRequestException,
  ConflictException,
  HttpException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Database } from '@box/database';
import type { AuthUser } from '@box/types';
import type { ApiEnv } from '@box/validation';
import type { Redis } from 'ioredis';
import { digest, hashPassword, newToken, verifyPassword } from './crypto.js';
import type { ResetMailer } from './mail.js';
import { createLogger } from '@box/logger';

const publicUser = (user: {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
}): AuthUser => ({
  id: user.id,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
});
export interface AuthRuntime {
  service: AuthService;
  limit: (key: string, maximum: number) => Promise<void>;
}
export function redisLimiter(redis: Redis) {
  return async (key: string, maximum: number) => {
    let count: unknown;
    try {
      count = await redis.eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],600) end; return n",
        1,
        `auth:rate:${digest(key)}`,
      );
    } catch {
      throw new ServiceUnavailableException('登入服務暫時不可用');
    }
    if (Number(count) > maximum)
      throw new HttpException('請求過於頻繁，請稍後重試', 429);
  };
}

export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly env: ApiEnv,
    private readonly mailer?: ResetMailer,
  ) {}
  private expiry() {
    return new Date(Date.now() + this.env.AUTH_SESSION_DAYS * 86400000);
  }
  async register(email: string, password: string) {
    const passwordHash = await hashPassword(password);
    const token = newToken();
    const expiresAt = this.expiry();
    try {
      const user = await this.db.user.create({
        data: {
          email,
          passwordHash,
          sessions: { create: { tokenHash: digest(token), expiresAt } },
        },
      });
      return { user: publicUser(user), token, expiresAt };
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException('無法建立帳戶，請嘗試登入或重設密碼');
      throw error;
    }
  }
  async login(email: string, password: string) {
    const candidate = await this.db.user.findUnique({ where: { email } });
    const valid = await verifyPassword(password, candidate?.passwordHash);
    if (!valid || !candidate)
      throw new UnauthorizedException('郵箱或密碼不正確');
    const token = newToken();
    const expiresAt = this.expiry();
    const user = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${candidate.id} FOR UPDATE`;
      const current = await tx.user.findUniqueOrThrow({
        where: { id: candidate.id },
      });
      if (current.passwordHash !== candidate.passwordHash)
        throw new UnauthorizedException('請重新登入');
      await tx.session.deleteMany({
        where: { userId: current.id, expiresAt: { lte: new Date() } },
      });
      await tx.session.create({
        data: { userId: current.id, tokenHash: digest(token), expiresAt },
      });
      return current;
    });
    return { user: publicUser(user), token, expiresAt };
  }
  async current(token: string | undefined) {
    if (!token) throw new UnauthorizedException('請先登入');
    const session = await this.db.session.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: true },
    });
    if (!session || session.expiresAt.getTime() <= Date.now())
      throw new UnauthorizedException('登入已過期，請重新登入');
    return publicUser(session.user);
  }
  async logout(token: string | undefined) {
    if (token)
      await this.db.session.deleteMany({ where: { tokenHash: digest(token) } });
  }
  async forgot(email: string) {
    if (!this.mailer)
      throw new ServiceUnavailableException('密碼重設郵件服務尚未配置');
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user) return;
    const token = newToken();
    const tokenHash = digest(token);
    await this.db.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60000),
      },
    });
    // Put the bearer token in the fragment: it is not sent in HTTP request URLs or access logs.
    const url = new URL('/reset-password', this.env.WEB_ORIGIN);
    url.hash = token;
    try {
      await this.mailer.send(email, url.toString());
    } catch {
      await this.db.passwordResetToken.deleteMany({ where: { tokenHash } });
      // Return the same public response as an unknown address; never expose provider errors.
      createLogger('api', this.env.LOG_LEVEL).error(
        'Password reset email delivery failed',
      );
    }
  }
  async reset(token: string, password: string) {
    const tokenHash = digest(token);
    const candidate = await this.db.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (
      !candidate ||
      candidate.usedAt ||
      candidate.expiresAt.getTime() <= Date.now()
    )
      throw new BadRequestException('重設連結無效或已過期');
    const passwordHash = await hashPassword(password);
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${candidate.userId} FOR UPDATE`;
      const claimed = await tx.passwordResetToken.updateMany({
        where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new BadRequestException('重設連結無效或已過期');
      await tx.user.update({
        where: { id: candidate.userId },
        data: { passwordHash },
      });
      await tx.session.deleteMany({ where: { userId: candidate.userId } });
      await tx.passwordResetToken.updateMany({
        where: { userId: candidate.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });
  }
}
