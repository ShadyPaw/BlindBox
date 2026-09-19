import { expect, test, type Page } from '@playwright/test';

const base = 'http://127.0.0.1:3100';
async function openRecharge(page: Page) {
  await page.goto(`${base}/wallet`);
  await page.getByRole('button', { name: '＋ 充值預覽' }).click();
  return page.getByRole('dialog', { name: '充值預覽' });
}

test('wallet filters, details, empty/error states and retry', async ({
  page,
}) => {
  await page.goto(`${base}/wallet`);
  await expect(page.locator('.wallet-balance')).toHaveText('$128.50');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel('交易類型').selectOption('DEBIT');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: '查看 DEMO-003' }).click();
  await expect(page.getByRole('dialog')).toContainText('−$21.50');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '★ 金幣錢包' }).click();
  await expect(page.locator('.wallet-balance')).toHaveText('★ 500.00');
  await page.getByLabel('交易類型').selectOption('DEBIT');
  await expect(
    page.getByRole('heading', { name: '暫無交易記錄' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '清除篩選' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByText('預覽情境', { exact: true }).click();
  await page.getByLabel('頁面狀態').selectOption('unavailable');
  await expect(
    page.getByRole('heading', { name: '錢包服務暫時無法使用' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '重試', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '錢包服務暫時無法使用' }),
  ).toBeVisible();
  await page.getByLabel('頁面狀態').selectOption('empty');
  await expect(page.locator('.wallet-balance')).toHaveText('★ 0.00');
  await expect(
    page.getByRole('heading', { name: '暫無交易記錄' }),
  ).toBeVisible();
});

test('recharge validates amounts, preserves back navigation and never credits money', async ({
  page,
}) => {
  const writes: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') writes.push(request.url());
  });
  const dialog = await openRecharge(page);
  await dialog.getByLabel('充值金額（USD）').fill('5.001');
  await dialog.getByRole('button', { name: '下一步：付款方式' }).click();
  await expect(dialog.getByRole('alert')).toContainText('最多兩位小數');
  await dialog.getByLabel('充值金額（USD）').fill('25.01');
  await dialog.getByRole('button', { name: '下一步：付款方式' }).click();
  await dialog.getByRole('radio', { name: /電子錢包/ }).check();
  await dialog.getByRole('button', { name: '上一步', exact: true }).click();
  await expect(dialog.getByLabel('充值金額（USD）')).toHaveValue('25.01');
  await dialog.getByRole('button', { name: '下一步：付款方式' }).click();
  await expect(dialog.getByRole('radio', { name: /電子錢包/ })).toBeChecked();
  await dialog.getByRole('button', { name: '下一步：確認資料' }).click();
  await expect(dialog).toContainText('$25.01');
  await dialog.getByRole('button', { name: '開始演示付款' }).click();
  await dialog.getByRole('button', { name: '查看演示結果' }).click();
  await expect(
    dialog.getByRole('heading', { name: '演示付款成功' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: '返回錢包' }).click();
  await expect(page.locator('.wallet-balance')).toHaveText('$128.50');
  expect(writes).toEqual([]);
  await page.reload();
  await expect(page.locator('.wallet-balance')).toHaveText('$128.50');
});

for (const [outcome, label] of [
  ['FAILED', '失敗'],
  ['CANCELLED', '取消'],
] as const) {
  test(`mobile recharge ${label}, retry and close reset`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const dialog = await openRecharge(page);
    await dialog.getByRole('button', { name: '$50', exact: true }).click();
    await dialog.getByRole('button', { name: '下一步：付款方式' }).click();
    await dialog.getByRole('button', { name: '下一步：確認資料' }).click();
    await dialog.getByLabel('演示結果').selectOption(outcome);
    await dialog.getByRole('button', { name: '開始演示付款' }).click();
    await dialog.getByRole('button', { name: '查看演示結果' }).click();
    await expect(
      dialog.getByRole('heading', { name: `演示付款${label}` }),
    ).toBeVisible();
    await dialog.getByRole('button', { name: '重新選擇金額' }).click();
    await expect(dialog.getByLabel('充值金額（USD）')).toHaveValue('50');
    const bounds = await dialog.boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(390);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '＋ 充值預覽' }).click();
    await expect(dialog.getByLabel('充值金額（USD）')).toHaveValue('25');
    await page.keyboard.press('Escape');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
