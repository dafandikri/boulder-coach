import { test, expect } from '@playwright/test';

// BC-11 — bottom tab nav smoke. The shared shell renders a persistent bottom tab
// bar on every page; it must switch between top-level tabs and reflect the active
// route via aria-current. (Substance shipped with BC-23; this is the AC's smoke.)
test('bottom nav switches tabs and marks the active one', async ({ page }) => {
  await page.goto('/profile');

  const nav = page.getByRole('navigation');
  await expect(nav).toBeVisible();

  await nav.getByRole('link', { name: 'Insights' }).click();
  await expect(page).toHaveURL(/\/insights$/);
  await expect(nav.getByRole('link', { name: 'Insights' })).toHaveAttribute('aria-current', 'page');

  await nav.getByRole('link', { name: 'Program' }).click();
  await expect(page).toHaveURL(/\/program$/);
  await expect(nav.getByRole('link', { name: 'Program' })).toHaveAttribute('aria-current', 'page');
});
