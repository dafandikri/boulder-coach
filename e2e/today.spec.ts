import { test, expect } from '@playwright/test';

test('app boots and renders the root page', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.ok()).toBe(true);
  await expect(page.locator('body')).toBeVisible();
});
