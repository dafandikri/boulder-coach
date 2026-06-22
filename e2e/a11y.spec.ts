import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * BC-37 — accessibility gate. A one-handed, thumb-driven, sweaty-fingers-at-the-gym
 * app is exactly where contrast, hit targets, focus order, and labels matter. axe-core
 * runs against the production build on every route; any serious/critical WCAG 2 A/AA
 * violation fails the suite. Run in CI (`pnpm e2e`), not the inner `pnpm gate` loop.
 *
 * BASELINE: the bright brand/semantic palette has known contrast debt (white-on-brand
 * CTAs, success green, badge tints) whose fix is a design pass that must be coordinated
 * with the brand owner — tracked as BC-25. Those specific colour PAIRS are baselined
 * below so the gate starts green; ANY new contrast pair, or any non-contrast serious/
 * critical violation, still fails. The neutral text colour (#8d8497) was genuinely
 * fixed in globals.css (--text-soft), not baselined.
 */

type AxeResults = Awaited<ReturnType<InstanceType<typeof AxeBuilder>['analyze']>>;
type Violation = AxeResults['violations'][number];
type ViolationNode = Violation['nodes'][number];

/** Known brand/semantic `fg|bg` contrast pairs, deferred to BC-25 (brand-owner pass). */
const BASELINE_CONTRAST_PAIRS = new Set([
  '#ff6a39|#ffffff', // --brand text on white
  '#ffffff|#ff6a39', // white on --brand (primary CTA)
  '#e84e1c|#ffffff', // --brand-deep text on white
  '#ffffff|#74d13c', // white on --success
  '#eaa200|#fff2cf', // warning badge text on tint
  '#e84e1c|#fff2cf', // brand-deep on warning tint
  '#579d2d|#e9f8e0', // success-ish on tint
  '#51ad1f|#e6f8d6', // success on tint
  '#1c80cd|#dbeefc', // info on tint
  // Conditionally-rendered Callouts (install prompt, error/data-damaged) — their deep-on-tint
  // pairs only appear on runs where the card renders, so axe's *composited* values must be
  // baselined explicitly or the a11y e2e flakes. Composited ≠ raw CSS var (border/opacity blend).
  '#e84e1c|#ffe8dd', // --brand-deep on --brand-tint (<Callout tone="brand"> — BC-39 install/nudge)
  '#bf4135|#ffe4e2', // --danger-deep on --danger-tint, composited (<Callout tone="danger"> — error/data-damaged)
  '#bf672d|#ffece0', // --warning-deep on --warning-tint, composited (<Callout tone="warning"> — eviction nudge)
]);

function contrastPairs(node: ViolationNode): string[] {
  const pairs: string[] = [];
  for (const check of node.any) {
    if (check.id !== 'color-contrast') continue;
    const data = check.data as { fgColor?: unknown; bgColor?: unknown } | null;
    if (data && typeof data.fgColor === 'string' && typeof data.bgColor === 'string') {
      pairs.push(`${data.fgColor.toLowerCase()}|${data.bgColor.toLowerCase()}`);
    }
  }
  return pairs;
}

/** A contrast violation is baselined only when EVERY failing node is a known BC-25 pair. */
function isBaselined(v: Violation): boolean {
  if (v.id !== 'color-contrast') return false;
  return v.nodes.every((n) => {
    const pairs = contrastPairs(n);
    return pairs.length > 0 && pairs.every((p) => BASELINE_CONTRAST_PAIRS.has(p));
  });
}

async function blockingViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return violations.filter(
    (v) => (v.impact === 'serious' || v.impact === 'critical') && !isBaselined(v),
  );
}

function summarise(violations: Violation[]): string {
  return violations
    .map((v) => `${v.id} (${v.impact ?? '?'}) ×${v.nodes.length}: ${v.help}`)
    .join('\n');
}

const ROUTES = [
  '/profile',
  '/checkin',
  '/session',
  '/insights',
  '/program',
  '/drills',
  '/exercises',
  '/history',
  '/log',
];

for (const route of ROUTES) {
  test(`no serious/critical a11y violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
    const violations = await blockingViolations(page);
    expect(violations, summarise(violations)).toEqual([]);
  });
}

test('Today (after onboarding) has no serious/critical a11y violations', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: /start training/i }).click();
  await page.waitForURL('/');
  await page.waitForLoadState('networkidle');
  const violations = await blockingViolations(page);
  expect(violations, summarise(violations)).toEqual([]);
});

test('honours prefers-reduced-motion without breaking the page', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/profile');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
