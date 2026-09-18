import { test, expect } from '@playwright/test';
for (const [service, port] of [
  ['web', 3000],
  ['admin', 3001],
] as const) {
  test(`${service} serves its production page and health endpoint`, async ({
    page,
    request,
  }) => {
    const base = `http://127.0.0.1:${port}`;
    await page.addInitScript(() =>
      sessionStorage.setItem('turbox-welcome-dismissed', '1'),
    );
    await page.goto(base);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      service === 'web' ? 'TURBOX 神秘盲盒' : `The Box · ${service}`,
    );
    const response = await request.get(`${base}/health`);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', service });
  });
}
