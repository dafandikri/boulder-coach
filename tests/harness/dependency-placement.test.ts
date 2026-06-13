import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// BC-26 — Tier-1 guard: dev-only tooling must NOT sit in production `dependencies`.
//
// Why this exists: the gate verifies a dependency is *used*, not that it lives in the
// *right* section. knip's Playwright plugin counts `playwright` as "used" wherever it
// sits, so `pnpm gate` stayed green when a Copilot merge added the full `playwright`
// browser package to production `dependencies` (LEARNINGS 2026-06-12). Only human review
// caught it. This promotes that "review caught what the gate missed" class to Tier-1.
//
// The denylist is data-driven: adding a dev tool is a one-line edit here. Entries ending
// in `*` are prefix patterns (e.g. `@vitest/*` matches `@vitest/coverage-v8`); the rest
// are exact package names.
const DEV_ONLY_DENYLIST: readonly string[] = [
  'playwright',
  '@playwright/test',
  'vitest',
  '@vitest/*',
  'eslint',
  'eslint-config-next',
  'eslint-config-prettier',
  'prettier',
  'type-coverage',
  'knip',
  'dependency-cruiser',
  'husky',
  'lint-staged',
  '@types/*',
  'typescript-eslint',
  'fake-indexeddb',
];

/** True when `name` matches a denylist entry (exact, or `prefix*` wildcard). */
function isDevOnly(name: string): boolean {
  return DEV_ONLY_DENYLIST.some((pattern) =>
    pattern.endsWith('*') ? name.startsWith(pattern.slice(0, -1)) : name === pattern,
  );
}

/** The dev-only tools that have leaked into a production-`dependencies` map. */
function misplacedDevTools(dependencies: Record<string, string>): string[] {
  return Object.keys(dependencies).filter(isDevOnly);
}

function readDependencies(): Record<string, string> {
  const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  return pkg.dependencies ?? {};
}

describe('BC-26 — dev-only tooling stays out of production dependencies', () => {
  it('flags a known dev tool that has leaked into dependencies (the BC-11/Copilot bug)', () => {
    // The exact shape of the regression that shipped green: playwright in prod deps.
    const leaked = { next: '16.2.7', playwright: '^1.60.0', react: '19.2.4' };
    expect(misplacedDevTools(leaked)).toEqual(['playwright']);
  });

  it('matches scoped wildcard tools (e.g. @vitest/coverage-v8, @types/node)', () => {
    const leaked = { react: '19.2.4', '@vitest/coverage-v8': '^4', '@types/node': '^20' };
    expect(misplacedDevTools(leaked).sort()).toEqual(['@types/node', '@vitest/coverage-v8']);
  });

  it('passes clean runtime-only dependencies (no false positives)', () => {
    const clean = { next: '16.2.7', react: '19.2.4', dexie: '^4.4.3' };
    expect(misplacedDevTools(clean)).toEqual([]);
  });

  it("the real package.json's production dependencies contain no dev-only tooling", () => {
    expect(misplacedDevTools(readDependencies())).toEqual([]);
  });
});
