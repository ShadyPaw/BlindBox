import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Inject,
  Query,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { walletTransactionsQuerySchema, type ApiEnv } from '@box/validation';
import { createLogger } from '@box/logger';
import type { FastifyRequest } from 'fastify';
import type { AuthRuntime } from '../auth/service.js';
import { sessionToken } from '../auth/session-cookie.js';
import type { WalletQueryService } from './query-service.js';

@Controller('wallet')
export class WalletController {
  constructor(
    @Inject('WALLET_QUERY') private readonly wallet: WalletQueryService | null,
    @Inject('AUTH_RUNTIME') private readonly auth: AuthRuntime | null,
    @Inject('API_ENV') private readonly env: ApiEnv,
  ) {}

  private async read<T>(
    request: FastifyRequest,
    action: (wallet: WalletQueryService, userId: string) => Promise<T>,
  ) {
    try {
      if (!this.auth || !this.wallet)
        throw new ServiceUnavailableException('Wallet service unavailable');
      const user = await this.auth.service.current(
        sessionToken(request.headers.cookie, this.env),
      );
      // Identity comes exclusively from the verified session, never a query/body userId.
      return await action(this.wallet, user.id);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      createLogger('api', this.env.LOG_LEVEL).error(
        { event: 'wallet.read.failed' },
        'Wallet query failed',
      );
      throw new ServiceUnavailableException('Wallet service unavailable');
    }
  }

  @Get('balances')
  balances(
    @Req() request: FastifyRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.read(request, (wallet, userId) => {
      if (Object.keys(query).length)
        throw new BadRequestException('Unexpected wallet query parameters');
      return wallet.balances(userId);
    });
  }

  @Get('transactions')
  transactions(@Req() request: FastifyRequest, @Query() query: unknown) {
    return this.read(request, (wallet, userId) => {
      const parsed = walletTransactionsQuerySchema.safeParse(query);
      if (!parsed.success)
        throw new BadRequestException('Invalid wallet filters');
      return wallet.transactions(userId, parsed.data);
    });
  }
}
