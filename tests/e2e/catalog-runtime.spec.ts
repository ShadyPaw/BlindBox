import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { formatMoney, parseMinor } from '@box/money';
import type { CatalogDetail } from '@box/types';
import { createDatabase } from '../../packages/database/dist/index.js';

const base = 'http://127.0.0.1:3100';
test.describe.configure({ mode: 'serial' });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem('turbox-welcome-dismissed', '1'),
  );
});
test('shared Pocket Paradise slug keeps both mode-specific routes and prices', async ({
  page,
  request,
}) => {
  for (const [mode, route] of [
    ['CONSUMER', 'boxes'],
    ['COIN', 'coin-boxes'],
  ] as const) {
    const response = await request.get(
      `http://127.0.0.1:3102/catalog/boxes/pocket-paradise?mode=${mode}`,
    );
    expect(response.status()).toBe(200);
    const detail: CatalogDetail = await response.json();
    expect(detail.box.mode).toBe(mode);
    await page.goto(`${base}/${route}/pocket-paradise`);
    await expect(page).toHaveURL(`${base}/${route}/pocket-paradise`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pocket Paradise',
    );
    await expect(
      page.getByRole('button', {
        name: `以 ${formatMoney(parseMinor(detail.box.priceMinor), detail.box.priceUnit)} 開箱`,
        exact: true,
      }),
    ).toBeVisible();
  }
});
test('PostgreSQL updates appear on detail, listing and homepage after refresh', async ({
  page,
}) => {
  const db = createDatabase(process.env.DATABASE_URL!);
  const id = randomUUID();
  const slug = `runtime-${id}`;
  try {
    await db.catalogBox.create({
      data: {
        id,
        sourceKey: slug,
        slug,
        name: 'Box A',
        image: '/reference/00a997ed93ec5d77.png',
        mode: 'CONSUMER',
        category: 'runtime',
        tags: ['new'],
        displayOrder: -100,
        publicationStatus: 'PUBLISHED',
        completenessStatus: 'INCOMPLETE',
        priceMinor: 699n,
        priceUnit: 'USD',
      },
    });
    await page.goto(`${base}/boxes/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Box A');
    await expect(
      page.getByText('參考資料尚未補齊', { exact: false }),
    ).toBeVisible();
    await expect(page.locator('.box-card')).toHaveCount(6);
    await db.catalogBox.update({
      where: { id },
      data: { name: 'Box A Updated', priceMinor: 799n },
    });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Box A Updated',
    );
    await expect(page).toHaveTitle('Box A Updated · TURBOX');
    await expect(
      page.getByRole('button', { name: '以 $7.99 開箱', exact: true }),
    ).toBeVisible();
    await page.goto(`${base}/boxes`);
    await expect(page.locator('.box-card').first()).toContainText(
      'Box A Updated',
    );
    await page.goto(base);
    // Index zero is the fifth slide in the existing featured carousel.
    for (let i = 0; i < 4; i++)
      await page.getByRole('button', { name: '下一個盲盒' }).click();
    await expect(page.locator('.hero-caption h2')).toHaveText('Box A Updated');
    await db.catalogBox.update({
      where: { id },
      data: { publicationStatus: 'DRAFT' },
    });
    await page.goto(`${base}/boxes/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '找不到',
    );
  } finally {
    await db.catalogBox.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});
for (const staleStatus of [200, 503])
  test(`out-of-order ${staleStatus} responses cannot overwrite newer filters, errors or loading state`, async ({
    page,
  }) => {
    // Deliberately simulate a transport that ignores cancellation. The version guard must still win.
    await page.addInitScript(() => {
      const original = window.fetch.bind(window);
      window.fetch = (input, init) => {
        if (String(input).startsWith('/api/catalog/boxes')) {
          const options = { ...init };
          delete options.signal;
          return original(input, options);
        }
        return original(input, init);
      };
    });
    let releaseOld!: () => void;
    const oldGate = new Promise<void>((resolve) => {
      releaseOld = resolve;
    });
    let oldStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      oldStarted = resolve;
    });
    let oldFinished!: () => void;
    const finished = new Promise<void>((resolve) => {
      oldFinished = resolve;
    });
    await page.route('**/api/catalog/boxes?**', async (route) => {
      if (
        new URL(route.request().url()).searchParams.get('search') === 'Everyday'
      ) {
        const response = await route.fetch();
        oldStarted();
        await oldGate;
        await route.fulfill({ response, status: staleStatus });
        oldFinished();
      } else await route.continue();
    });
    await page.goto(`${base}/boxes`);
    await page.getByRole('searchbox').fill('Everyday');
    await started;
    await page.getByRole('searchbox').fill('Charizard');
    await expect(page.locator('.box-card')).toHaveCount(2);
    await expect(page.locator('.box-grid')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    const oldResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).searchParams.get('search') === 'Everyday',
    );
    releaseOld();
    await finished;
    const delivered = await oldResponse;
    // Success reads JSON; a 503 is handled at the headers and its body is never consumed.
    if (staleStatus === 200) await delivered.finished();
    // Let the application's response/error continuation run before asserting unchanged UI.
    await page.evaluate(async () => {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });
    await expect(page.locator('.box-card')).toHaveCount(2);
    await expect(page.locator('.box-card').first()).toContainText('Charizard');
    await expect(page.locator('.box-grid')).toHaveAttribute(
      'aria-busy',
      'false',
    );
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
  });
test('filter failure shows unavailable without static data and supports retry', async ({
  page,
}) => {
  await page.goto(`${base}/boxes`);
  await expect(page.locator('.box-card')).toHaveCount(36);
  await page.route('**/api/catalog/boxes?**', (route) =>
    route.fulfill({
      status: 503,
      json: { message: 'Catalog service unavailable' },
    }),
  );
  await page.getByRole('searchbox').fill('Everyday');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Catalog service unavailable',
  );
  await expect(page.locator('.box-card')).toHaveCount(0);
  await page.unroute('**/api/catalog/boxes?**');
  await page.getByRole('button', { name: '重試', exact: true }).click();
  await expect(page.locator('.box-card')).toHaveCount(1);
  await expect(page.locator('.box-card')).toContainText('Everyday Sync');
});
test('server-rendered catalog explicitly fails when its API is unavailable', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3104/boxes');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Catalog service unavailable',
  );
  await expect(page.locator('.box-card')).toHaveCount(0);
});
