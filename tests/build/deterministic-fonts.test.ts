import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Tier-1 guard for the "brand fonts don't reliably reach production" failure
// class — it has now bitten the gate TWICE, so it lives as an executable check
// rather than prose a memoryless agent has to remember:
//
//   2026-06-10  `next/font/google` downloads .woff2 from fonts.gstatic.com AT
//               BUILD TIME, so `next build` (gate step 8/8) flaked on any blip.
//   2026-06-12  the brand fonts were loaded with a CSS `@import url(googleapis)`
//               in globals.css. A CSS @import is only valid before all other
//               rules, so once Next bundles globals.css behind another package's
//               @font-face the production optimizer SILENTLY DROPS it — prod
//               renders in system fonts and looks generic/"bland" (BC-23 bug).
//
// The robust path that satisfies both: load the webfonts with a real document
// <link rel="stylesheet"> in layout.tsx (a runtime browser fetch — deterministic
// build, and immune to CSS bundling). These guards block re-introducing either
// broken pattern: the gate fails, not someone's memory.

const srcRoot = fileURLToPath(new URL('../../src', import.meta.url));
const layoutFile = fileURLToPath(new URL('../../src/app/layout.tsx', import.meta.url));

const filesUnder = (dir: string, re: RegExp): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) return filesUnder(full, re);
    return re.test(name) ? [full] : [];
  });

describe('build is network-independent (fonts self-hosted)', () => {
  it('no src file imports next/font/google (build-time CDN fetch = flaky gate)', () => {
    const offenders = filesUnder(srcRoot, /\.(ts|tsx)$/).filter((file) =>
      /from\s+['"]next\/font\/google['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('no src CSS uses a remote @import url() — the prod optimizer drops it (fonts vanish)', () => {
    const offenders = filesUnder(srcRoot, /\.css$/).filter((file) =>
      /@import\s+url\(\s*['"]?https?:/i.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });

  it('layout.tsx loads the brand webfonts via a <link rel="stylesheet"> (bundle-proof)', () => {
    const layout = readFileSync(layoutFile, 'utf8');
    expect(layout).toMatch(/rel=["']stylesheet["']/);
    expect(layout).toContain('fonts.googleapis.com');
  });
});
