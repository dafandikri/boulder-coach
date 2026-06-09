import { test, expect } from '@playwright/test';

test('check-in and session routes boot', async ({ page }) => {
  const checkin = await page.goto('/checkin');
  expect(checkin?.ok()).toBe(true);
  await expect(page.getByRole('heading', { name: 'Check-in' })).toBeVisible();

  const session = await page.goto('/session');
  expect(session?.ok()).toBe(true);
});
