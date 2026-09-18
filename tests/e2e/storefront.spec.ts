import { test, expect } from '@playwright/test';

const base = 'http://127.0.0.1:3100';
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem('turbox-welcome-dismissed', '1'),
  );
});

test('catalog filters, sorts, clears and links to a persistent detail page', async ({
  page,
}) => {
  await page.goto(`${base}/boxes`);
  const cards = page.locator('.box-card');
  await expect(cards).toHaveCount(36);
  await page.getByRole('searchbox', { name: '按名稱搜尋' }).fill('charizard');
  await expect(cards).toHaveCount(2);
  await page.getByLabel('最高價格', { exact: true }).fill('2');
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText('Charizard Across Eras');
  await page.getByRole('button', { name: '清除篩選' }).click();
  await page.getByLabel('排序方式').selectOption('low');
  await expect(cards.first()).toContainText('One Piece Voyage');
  await page.getByRole('searchbox').fill('not-a-real-box');
  await expect(
    page.getByRole('heading', { name: '沒有符合條件的盲盒' }),
  ).toBeVisible();
  await page.getByRole('searchbox').fill('Everyday');
  await cards.first().click();
  await expect(page).toHaveURL(`${base}/boxes/everyday-sync`);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Everyday Sync',
  );
});

test('detail quantity, switches, prize information and sign-in validation', async ({
  page,
}) => {
  await page.goto(`${base}/boxes/everyday-sync`);
  await page.getByRole('button', { name: '3', exact: true }).click();
  await expect(
    page.getByRole('button', { name: '以 $7.74 開箱' }),
  ).toBeVisible();
  await page.getByRole('switch', { name: '極速開箱' }).click();
  await expect(page.getByRole('switch', { name: '極速開箱' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.locator('.prize-card').first().click();
  await expect(page.getByRole('dialog')).toContainText('0.017%');
  await page.getByRole('button', { name: '關閉', exact: true }).click();
  await page.getByRole('button', { name: '以 $7.74 開箱' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('button', { name: '登入', exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole('textbox', { name: '電子郵箱', exact: true })
    .fill('preview@example.com');
  await dialog
    .getByLabel('密碼', { exact: true })
    .fill('wrong password example');
  await dialog.getByRole('button', { name: '登入', exact: true }).click();
  await expect(dialog.getByRole('status')).toContainText('郵箱或密碼不正確');
  await expect(dialog.getByLabel('密碼', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('welcome gift, rewards and ranking navigation', async ({ page }) => {
  await page.goto(base);
  await page.getByRole('button', { name: '3 個優惠' }).click();
  await expect(page.getByRole('dialog')).toContainText('免費獲得 1 個神秘盲盒');
  await page.getByRole('button', { name: '關閉歡迎禮物' }).click();
  await page.getByRole('link', { name: '更多免費福利' }).click();
  await expect(page.locator('.reward-card')).toHaveCount(8);
  await page.locator('.reward-card').first().click();
  await expect(
    page.getByRole('dialog', { name: '歡迎來到 Turbox' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(`${base}/ranking`);
  await expect(page.locator('.ranking-row')).toHaveCount(7);
  await page.getByRole('button', { name: '上期', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '暫無上期排名' }),
  ).toBeVisible();
});

test('mobile catalog and dialog fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/boxes`);
  await expect(
    page.getByRole('navigation', { name: '手機導覽' }),
  ).toBeVisible();
  const width = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));
  expect(width.page).toBeLessThanOrEqual(width.viewport);
  await page.getByRole('button', { name: '註冊', exact: true }).click();
  const bounds = await page.getByRole('dialog').boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(390);
});

test('free mode uses coin prices, survives detail reload and returns to cash mode', async ({
  page,
}) => {
  await page.goto(base);
  await page.getByRole('button', { name: '免費', exact: true }).click();
  await expect(page).toHaveURL(`${base}/coin-boxes`);
  await expect(page.locator('.coin-card')).toHaveCount(18);
  await page
    .getByRole('link', { name: 'Cozy Christmas ★ 99.00', exact: true })
    .click();
  await expect(page).toHaveURL(`${base}/coin-boxes/cozy-christmas`);
  await page.reload();
  await expect(
    page.getByRole('button', { name: '免費', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.prize-card')).toHaveCount(18);
  await page.getByRole('button', { name: '2', exact: true }).click();
  await page
    .getByRole('button', { name: '以 ★ 198.00 開箱', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '消費', exact: true }).click();
  await expect(page).toHaveURL(`${base}/`);
  await expect(
    page.getByRole('button', { name: '消費', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});

test('auth policy navigation closes the modal and social links have real destinations', async ({
  page,
}) => {
  await page.goto(base);
  await expect(
    page.getByRole('link', { name: 'Instagram', exact: true }),
  ).toHaveAttribute('href', 'https://www.instagram.com/turboxgg_/');
  await page.getByRole('button', { name: '註冊', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: '隱私政策' })
    .click();
  await expect(page).toHaveURL(`${base}/protocol/privacy`);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '隱私政策' })).toBeVisible();
});
