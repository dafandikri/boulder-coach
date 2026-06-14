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
    icons?: { src?: string; sizes?: string; type?: string; purpose?: string }[];
    start_url?: string;
    display?: string;
  };
  const icons = manifest.icons ?? [];

  it('declares at least one icon (empty icons = not installable)', () => {
    expect(icons.length).toBeGreaterThan(0);
  });

  it('every icon has src, sizes and type', () => {
    for (const icon of icons) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBeTruthy();
    }
  });

  // BC-14: real branded maskable PNGs at both required sizes, and the file exists on disk
  // (so the manifest can't point at a missing asset). The maskable purpose is what makes
  // the home-screen launcher render a properly-cropped icon instead of a letterboxed one.
  it('ships maskable PNG icons at 192 and 512', () => {
    for (const size of ['192x192', '512x512']) {
      const icon = icons.find((i) => i.sizes === size && i.type === 'image/png');
      expect(icon, `missing ${size} PNG icon`).toBeTruthy();
      expect(icon?.purpose).toContain('maskable');
      expect(() => readFileSync(root(`public${icon?.src ?? ''}`))).not.toThrow();
    }
  });

  it('references an apple-touch-icon asset that exists', () => {
    expect(() => readFileSync(root('public/apple-touch-icon.png'))).not.toThrow();
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
