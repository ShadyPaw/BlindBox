import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ApiEnv,
} from '@box/validation';
import type { AuthRuntime } from './service.js';
import { sessionToken } from './session-cookie.js';

function validated<T>(
  schema: {
    safeParse(input: unknown): { success: true; data: T } | { success: false };
  },
  input: unknown,
): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new BadRequestException('請檢查輸入內容；新密碼須為 15–128 個字元');
  return result.data;
}

@Controller('auth')
export class AuthController {
  constructor(
    @Inject('AUTH_RUNTIME') private readonly auth: AuthRuntime | null,
    @Inject('API_ENV') private readonly env: ApiEnv,
  ) {}
  private runtime() {
    if (!this.auth) throw new ServiceUnavailableException();
    return this.auth;
  }
  private cookieName() {
    return this.env.NODE_ENV === 'production' || this.env.AUTH_COOKIE_SECURE
      ? '__Host-box_session'
      : 'box_session';
  }
  private token(req: FastifyRequest) {
    return sessionToken(req.headers.cookie, this.env);
  }
  private cookie(reply: FastifyReply, token: string, expiresAt: Date) {
    const secure =
      this.env.NODE_ENV === 'production' || this.env.AUTH_COOKIE_SECURE;
    reply.header(
      'Set-Cookie',
      `${this.cookieName()}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)) : 0}; Expires=${expiresAt.toUTCString()}${secure ? '; Secure' : ''}`,
    );
  }
  private async write(req: FastifyRequest, action: string) {
    if (
      !req.headers.origin ||
      !this.env.CORS_ORIGINS.includes(req.headers.origin) ||
      req.headers['x-box-csrf'] !== '1'
    )
      throw new ForbiddenException('不允許此請求來源');
    await this.runtime().limit(`ip:${req.ip}:${action}`, 120);
  }
  @Post('register')
  async register(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.write(req, 'register');
    const input = validated(registerSchema, body);
    await this.runtime().limit(`email:${input.email}:register`, 5);
    const result = await this.runtime().service.register(
      input.email,
      input.password,
    );
    await this.runtime().service.logout(this.token(req));
    this.cookie(reply, result.token, result.expiresAt);
    return { user: result.user };
  }
  @Post('login')
  @HttpCode(200)
  async login(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.write(req, 'login');
    const input = validated(loginSchema, body);
    await this.runtime().limit(`email:${input.email}:login`, 10);
    const result = await this.runtime().service.login(
      input.email,
      input.password,
    );
    await this.runtime().service.logout(this.token(req));
    this.cookie(reply, result.token, result.expiresAt);
    return { user: result.user };
  }
  @Get('me')
  async me(@Req() req: FastifyRequest) {
    return { user: await this.runtime().service.current(this.token(req)) };
  }
  @Get('admin/session')
  async admin(@Req() req: FastifyRequest) {
    const user = await this.runtime().service.current(this.token(req));
    if (user.role !== 'ADMIN') throw new ForbiddenException('需要管理員權限');
    return { user };
  }
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Req() req: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.write(req, 'logout');
    await this.runtime().service.logout(this.token(req));
    this.cookie(reply, '', new Date(0));
    return { message: '已登出' };
  }
  @Post('forgot-password')
  @HttpCode(200)
  async forgot(@Req() req: FastifyRequest, @Body() body: unknown) {
    await this.write(req, 'forgot');
    const { email } = validated(forgotPasswordSchema, body);
    await this.runtime().limit(`email:${email}:forgot`, 3);
    await this.runtime().service.forgot(email);
    return { message: '若此郵箱已註冊且郵件服務可用，您將收到密碼重設連結。' };
  }
  @Post('reset-password')
  @HttpCode(200)
  async reset(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    await this.write(req, 'reset');
    const { token, password } = validated(resetPasswordSchema, body);
    await this.runtime().service.reset(token, password);
    this.cookie(reply, '', new Date(0));
    return { message: '密碼已更新，請重新登入。' };
  }
}
