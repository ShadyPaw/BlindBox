import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createLogger } from '@box/logger';
import type { StorefrontQueryService } from './service.js';

@Controller('storefront')
export class StorefrontController {
  constructor(
    @Inject('STOREFRONT_SERVICE')
    private readonly service: StorefrontQueryService | null,
  ) {}

  @Get('home')
  async home() {
    if (!this.service)
      throw new ServiceUnavailableException('Storefront service unavailable');
    try {
      return await this.service.home();
    } catch {
      createLogger('api').error('Storefront query failed');
      throw new ServiceUnavailableException('Storefront service unavailable');
    }
  }
}
