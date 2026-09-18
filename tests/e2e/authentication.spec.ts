import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDatabase } from '../../packages/database/dist/index.js';

const base = 'http://127.0.0.1:3100';
const password = 'My original test password 123!';
const newPassword = 'My replacement test password 456!';

test('real registration, protected account, logout, reset and re-login', async ({
  page,
  request,
}) => {
  test.setTimeout(90000);
  const email = `browser-${randomUUID()}@example.com`;
  await page.addInitScript(() =>
    sessionStorage.setItem('turbox-welcome-dismissed', '1'),
  );
  const db = createDatabase(process.env.DATABASE_URL!);
  try {
    await page.goto(`${base}/account`);
    await expect(page).toHaveURL(`${base}/?login=1`);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '還沒有帳戶？註冊' })
      .click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('電子郵箱').fill(email);
    const submit = dialog.getByRole('button', { name: '建立帳戶' });
    await dialog.getByLabel('密碼', { exact: true }).fill('short123');
    await expect(submit).toBeDisabled();
    await expect(dialog.locator('#auth-requirements')).toContainText(
      '密碼至少需要 15 個字元，目前為 8 個',
    );
    await dialog.getByLabel('密碼', { exact: true }).fill(password);
    await dialog.getByLabel('確認密碼', { exact: true }).fill('different');
    await expect(dialog.locator('#auth-requirements')).toContainText(
      '兩次輸入的密碼不一致',
    );
    await dialog.getByLabel('確認密碼', { exact: true }).fill(password);
    await expect(submit).toBeDisabled();
    await expect(dialog.locator('#auth-requirements')).toContainText(
      '請勾選同意服務條款與隱私政策',
    );
    await dialog.getByRole('checkbox').check();
    await expect(submit).toBeEnabled();
    await expect(dialog.locator('#auth-requirements')).toBeEmpty();
    await submit.click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole('link', { name: '我的帳戶', exact: true }).click();
    await expect(page).toHaveURL(`${base}/account`);
    await expect(page.locator('.account-details')).toContainText(email);
    await page.reload();
    await expect(page.locator('.account-details')).toContainText(email);
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      'box_session',
    );
    const csrf = await request.post(`${base}/api/auth/logout`, {
      data: {},
      headers: { origin: 'https://evil.example', 'x-box-csrf': '1' },
    });
    expect(csrf.status()).toBe(403);
    await page.getByRole('button', { name: '登出', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '登入', exact: true }),
    ).toBeVisible();
    await page.goto(`${base}/account`);
    await expect(page).toHaveURL(`${base}/?login=1`);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '忘記密碼？' })
      .click();
    await page.getByRole('dialog').getByLabel('電子郵箱').fill(email);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '發送重設連結' })
      .click();
    await expect(page.getByRole('status')).toContainText('若此郵箱已註冊');
    let resetUrl = '';
    await expect
      .poll(async () => {
        const directory = resolve('.local/test-mail');
        const names = await readdir(directory).catch(() => [] as string[]);
        for (const name of names) {
          const mail = JSON.parse(
            await readFile(resolve(directory, name), 'utf8'),
          );
          if (mail.to === email) resetUrl = mail.url;
        }
        return resetUrl;
      })
      .not.toBe('');
    await page.goto(resetUrl);
    await page.getByLabel('新密碼', { exact: true }).fill(newPassword);
    await page.getByLabel('確認新密碼', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: '更新密碼' }).click();
    await expect(page.getByRole('status')).toContainText('所有舊登入已失效');
    await page.getByRole('link', { name: '返回登入' }).click();
    await page.getByRole('dialog').getByLabel('電子郵箱').fill(email);
    await page
      .getByRole('dialog')
      .getByLabel('密碼', { exact: true })
      .fill(newPassword);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '登入', exact: true })
      .click();
    await expect(
      page.getByRole('link', { name: '我的帳戶', exact: true }),
    ).toBeVisible();
  } finally {
    await db.user.deleteMany({ where: { email } });
    await db.$disconnect();
  }
});
