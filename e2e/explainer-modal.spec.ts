import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * The explainer (RPE / ACWR) modal's a11y + keyboard contract. The axe gate in
 * `a11y.spec.ts` scans the *static* page, so it never opens this dialog — modal
 * focus-management, focus-trap, and scroll-lock bugs would ship silently (the
 * exact blind spot that nearly shipped here; see LEARNINGS 2026-06-14). This spec
 * drives the OPEN state so that whole bug class is now a Tier-1 gate failure.
 */
test.describe('explainer modal', () => {
  test('opens from the (i) trigger, is axe-clean, and is keyboard-operable', async ({ page }) => {
    await page.goto('/insights');
    await page.waitForLoadState('networkidle');

    const trigger = page.getByRole('button', { name: /what is acwr/i });
    await trigger.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /what is acwr/i })).toBeVisible();
    await expect(dialog).toContainText(/Acute:Chronic Workload Ratio/i);

    // Focus is moved into the dialog on open (WAI-ARIA modal contract).
    const closeBtn = dialog.getByRole('button', { name: /close/i });
    await expect(closeBtn).toBeFocused();

    // axe on the open dialog subtree (scoped so unrelated page contrast debt
    // baselined in a11y.spec.ts isn't in frame — this asserts the dialog itself).
    const { violations } = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);

    // Tab / Shift+Tab stay trapped inside the dialog.
    await page.keyboard.press('Tab');
    await expect(closeBtn).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(closeBtn).toBeFocused();

    // Escape closes, restores focus to the trigger, and releases the scroll lock.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });

  test('closes on backdrop click', async ({ page }) => {
    await page.goto('/insights');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /what is rpe/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Click the top-left backdrop, away from the centred panel.
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });
});
