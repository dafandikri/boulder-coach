import { test, expect } from '@playwright/test';

/**
 * BC-16 — promotes the service-worker runtime behaviour (the HANDOFF's top gate-blind
 * risk) to a Tier-1 check. Runs against the production build (where the SW is active)
 * and asserts: the SW registers and activates, a precached route still loads with the
 * network cut, and the manifest is installable. Part of the CI `playwright test` step.
 */

test('service worker registers and a precached route loads offline', async ({ page, context }) => {
  // First online visit: register + activate the SW and let it precache the shell.
  await page.goto('/checkin'); // in the SW PRECACHE list, renders without a profile
  await expect(page.getByRole('heading', { name: 'Check-in' })).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // Let the install handler finish writing the precache before cutting the network.
  await page.waitForTimeout(1500);

  // Cut the network and reload — the shell must come from the SW cache, not the wire.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Check-in' })).toBeVisible();

  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  expect(controlled).toBe(true);

  await context.setOffline(false);
});

test('manifest is present and installable', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBe(true);

  const manifest = (await res.json()) as {
    name?: string;
    short_name?: string;
    start_url?: string;
    display?: string;
    icons?: { src?: string; sizes?: string; purpose?: string }[];
  };

  expect(manifest.name).toBeTruthy();
  expect(manifest.start_url).toBeTruthy();
  expect(manifest.display).toBe('standalone');

  const icons = manifest.icons ?? [];
  expect(icons.length).toBeGreaterThan(0);
  // Installability needs at least one maskable icon for the home-screen launcher.
  expect(icons.some((i) => (i.purpose ?? '').includes('maskable'))).toBe(true);
});
