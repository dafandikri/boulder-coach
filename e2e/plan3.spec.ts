import { test, expect } from '@playwright/test';

test('all Plan 3 routes boot', async ({ page }) => {
  for (const route of ['/history', '/insights', '/program', '/drills']) {
    const resp = await page.goto(route);
    expect(resp?.ok()).toBe(true);
  }
});
