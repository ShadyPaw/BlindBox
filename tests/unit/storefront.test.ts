import { describe, expect, it } from 'vitest';
import { StorefrontController } from '../../apps/api/src/storefront/controller.js';
import { StorefrontQueryService } from '../../apps/api/src/storefront/service.js';
import type { Database } from '../../packages/database/dist/index.js';

describe('storefront failure boundary', () => {
  it('does not disguise database failure as an empty homepage', async () => {
    const service = new StorefrontQueryService({
      $transaction: async () => {
        throw new Error('private database detail');
      },
    } as unknown as Database);
    await expect(
      new StorefrontController(service).home(),
    ).rejects.toMatchObject({
      status: 503,
      message: 'Storefront service unavailable',
    });
    await expect(new StorefrontController(null).home()).rejects.toMatchObject({
      status: 503,
    });
  });
});
