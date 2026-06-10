import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';

// Tier-1 promotion of the 2026-06-10 ledger entry (gate-blind PWA defects from a
// cross-model handoff). These guard the INVARIANTS so a memoryless agent that
// reverts to the old behavior is blocked by the gate, not by remembering.
// If you intentionally change the PWA strategy, update these tests deliberately.

const root = (p: string): string => fileURLToPath(new URL(`../../${p}`, import.meta.url));

describe('PWA manifest is installable', () => {
  const manifest = JSON.parse(readFileSync(root('public/manifest.webmanifest'), 'utf8')) as {
    icons?: { src?: string; sizes?: string; type?: string }[];
    start_url?: string;
    display?: string;
  };

  it('declares at least one icon (empty icons = not installable)', () => {
    expect(manifest.icons?.length ?? 0).toBeGreaterThan(0);
  });

  it('every icon has src, sizes and type', () => {
    for (const icon of manifest.icons ?? []) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBeTruthy();
    }
  });

  it('has standalone display and a start_url', () => {
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBeTruthy();
  });
});

describe('service worker is update-safe', () => {
  const sw = readFileSync(root('public/sw.js'), 'utf8');

  it('handles navigation requests explicitly', () => {
    expect(sw).toMatch(/mode === 'navigate'/);
  });

  it('serves navigations network-first (fetch before cache) so deploys reach users', () => {
    // The navigate branch must attempt fetch() and only fall back to caches.match.
    const navBranch = sw.slice(sw.indexOf("mode === 'navigate'"));
    const fetchIdx = navBranch.indexOf('fetch(request)');
    const cacheFallbackIdx = navBranch.indexOf('caches.match');
    expect(fetchIdx).toBeGreaterThanOrEqual(0);
    expect(cacheFallbackIdx).toBeGreaterThan(fetchIdx); // cache is the fallback, not the default
  });
});
