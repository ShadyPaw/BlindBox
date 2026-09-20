import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '../../packages/database/dist/index.js';
import type { CatalogDetail, CatalogList } from '@box/types';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem('turbox-welcome-dismissed', '1'),
  );
});

test('standalone H5 observes PostgreSQL updates on home, listing and detail', async ({
  page,
  request,
}) => {
  const db = createDatabase(process.env.DATABASE_URL!);
  const id = randomUUID(),
    slug = `h5-${id}`;
  try {
    await db.catalogBox.create({
      data: {
        id,
        sourceKey: slug,
        slug,
        name: 'Box A',
        image: '/reference/00a997ed93ec5d77.png',
        mode: 'CONSUMER',
        priceUnit: 'USD',
        priceMinor: 699n,
        category: 'h5-test',
        tags: ['hot'],
        displayOrder: -2000000000,
        publicationStatus: 'PUBLISHED',
        completenessStatus: 'INCOMPLETE',
      },
    });
    await page.goto('/');
    await expect(page.locator('.hero-caption h2')).toHaveText('Box A');
    await page
      .locator(`.hero-carousel a[href="/boxes/${slug}"]`)
      .first()
      .click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Box A');
    await expect(
      page.getByText('物品清單尚未接入', { exact: true }),
    ).toBeVisible();
    await expect(page.locator('.detail-page .box-card')).toHaveCount(6);
    await db.catalogBox.update({
      where: { id },
      data: { name: 'Box A Updated', priceMinor: 799n },
    });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Box A Updated',
    );
    await expect(page).toHaveTitle('Box A Updated · TURBOX');
    await expect(page.locator('.open-button')).toHaveText('以 $7.99 開箱');
    await page.goto('/boxes');
    await page.reload();
    await expect(page.locator('.box-card').first()).toContainText(
      'Box A Updated',
    );
    await page.goto('/');
    await page.reload();
    await expect(page.locator('.hero-caption h2')).toHaveText('Box A Updated');
    await db.catalogBox.update({
      where: { id },
      data: { publicationStatus: 'DRAFT' },
    });
    expect(
      (
        await request.get(
          `http://127.0.0.1:3202/catalog/boxes/${slug}?mode=CONSUMER`,
        )
      ).status(),
    ).toBe(404);
    await page.goto(`/boxes/${slug}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      '找不到',
    );
  } finally {
    await db.catalogBox.deleteMany({ where: { id } });
    await db.$disconnect();
  }
});

test('mode, filters, ordering, pagination and related boxes use real API', async ({
  page,
  request,
}) => {
  for (const [mode, route] of [
    ['CONSUMER', 'boxes'],
    ['COIN', 'coin-boxes'],
  ] as const) {
    const response = await request.get(
      `http://127.0.0.1:3202/catalog/boxes/pocket-paradise?mode=${mode}`,
    );
    expect(response.status()).toBe(200);
    const detail = (await response.json()) as CatalogDetail;
    expect(detail.box.mode).toBe(mode);
    expect(detail.relatedBoxes.length).toBeLessThanOrEqual(6);
    expect(
      detail.relatedBoxes.every(
        (b) => b.mode === mode && b.id !== detail.box.id,
      ),
    ).toBe(true);
    await page.goto(`/${route}/pocket-paradise`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      detail.box.name,
    );
    expect(
      await page
        .locator('.detail-page .box-card')
        .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('href'))),
    ).toEqual(detail.relatedBoxes.map((b) => `/${route}/${b.slug}`));
    const list = await request.get(
      `http://127.0.0.1:3202/catalog/boxes?mode=${mode}&sort=low&page=2&pageSize=2`,
    );
    const data = (await list.json()) as CatalogList;
    expect(data.page).toBe(2);
    expect(data.boxes).toHaveLength(2);
    expect(
      BigInt(data.boxes[0]!.priceMinor) <= BigInt(data.boxes[1]!.priceMinor),
    ).toBe(true);
    await page.goto(`/${route}?search=Pocket%20Paradise&sort=low`);
    await expect(page.locator('.box-card')).toHaveCount(1);
    await expect(page.locator('.box-card')).toContainText('Pocket Paradise');
    await page.getByRole('searchbox').fill('no-matching-box-xyz');
    await expect(page.locator('.box-card')).toHaveCount(0);
  }
});

test('real mode has explicit service failure and never falls back to snapshots', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3204/boxes');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Catalog service unavailable',
  );
  await expect(page.locator('.box-card')).toHaveCount(0);
  await page.goto('http://127.0.0.1:3204/');
  await expect(
    page.getByText('精選盲盒服務暫時不可用', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.hero-caption')).toHaveCount(0);
});

test('real registration, session reload, logout and re-login through standalone H5', async ({
  page,
}) => {
  const db = createDatabase(process.env.DATABASE_URL!);
  const email = `h5-${randomUUID()}@example.com`,
    password = 'H5 integration password 123!';
  try {
    await page.goto('/account');
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: '還沒有帳戶？註冊' }).click();
    await dialog.getByLabel('電子郵箱').fill(email);
    await dialog.getByLabel('密碼', { exact: true }).fill(password);
    await dialog.getByLabel('確認密碼', { exact: true }).fill(password);
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: '建立帳戶' }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('link', { name: '我的帳戶', exact: true }).click();
    await expect(page.locator('.account-details')).toContainText(email);
    await page.reload();
    await expect(page.locator('.account-details')).toContainText(email);
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      'box_session',
    );
    await page.getByRole('button', { name: '登出', exact: true }).click();
    await page.goto('/account');
    await dialog.getByLabel('電子郵箱').fill(email);
    await dialog.getByLabel('密碼', { exact: true }).fill(password);
    await dialog.getByRole('button', { name: '登入', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('.account-link')).toBeVisible();
  } finally {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
