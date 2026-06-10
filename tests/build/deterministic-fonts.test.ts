import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Tier-1 promotion of the 2026-06-10 ledger entry (font fetch flaked the gate
// TWICE). `next/font/google` downloads .woff2 from fonts.gstatic.com AT BUILD
// TIME, so `next build` (gate step 8/8, run on every push) is non-deterministic
// — it fails on any network blip. The fix is self-hosting via the `geist` pkg.
// This guard blocks a memoryless agent (or the Next.js scaffold default) from
// re-introducing the network dependency: the gate fails, not someone's memory.

const srcRoot = fileURLToPath(new URL('../../src', import.meta.url));

const tsFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) return tsFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });

describe('build is network-independent (fonts self-hosted)', () => {
  it('no src file imports next/font/google (build-time CDN fetch = flaky gate)', () => {
    const offenders = tsFiles(srcRoot).filter((file) =>
      /from\s+['"]next\/font\/google['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
