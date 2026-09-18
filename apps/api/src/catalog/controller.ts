import {
  BadRequestException,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Query,
  ServiceUnavailableException,
} from '@nestjs/common';
import { catalogQuerySchema, catalogDetailQuerySchema } from '@box/validation';
import { createLogger } from '@box/logger';
import type { CatalogQueryService } from './service.js';

@Controller('catalog/boxes')
export class CatalogController {
  constructor(
    @Inject('CATALOG_SERVICE')
    private readonly service: CatalogQueryService | null,
  ) {}
  private async run<T>(
    operation: (service: CatalogQueryService) => Promise<T>,
  ) {
    if (!this.service)
      throw new ServiceUnavailableException('Catalog service unavailable');
    try {
      return await operation(this.service);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      createLogger('api').error('Catalog query failed');
      throw new ServiceUnavailableException('Catalog service unavailable');
    }
  }
  @Get()
  list(@Query() input: unknown) {
    const result = catalogQuerySchema.safeParse(input);
    if (!result.success)
      throw new BadRequestException('Invalid catalog filters');
    return this.run((service) => service.list(result.data));
  }
  @Get(':slug')
  detail(@Param('slug') slug: string, @Query() input: unknown) {
    if (!/^[a-z0-9-]{1,160}$/.test(slug))
      throw new BadRequestException('Invalid catalog slug');
    const result = catalogDetailQuerySchema.safeParse(input);
    if (!result.success) throw new BadRequestException('Invalid catalog mode');
    return this.run((service) => service.detail(slug, result.data.mode));
  }
}
