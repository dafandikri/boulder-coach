// @ts-check
// BC-36 — Tier-1 bundle-size budget. Bounds the JS shipped to the phone so a PWA
// opened on gym cell data can't degrade silently as dependencies creep. Measures the
// gzipped App-Router first-load JS (build-manifest `rootMainFiles` + polyfills) and
// fails by number when it exceeds the data-driven ceiling in `.size-limit.json`.
// Zero-dependency (node:zlib) on purpose — no new prod/dev dep to audit.
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Pure budget summary — separated from I/O so it's unit-testable without a real build.
 * @param {{ files: string[]; sizeOf: (file: string) => number; limitBytes: number }} args
 * @returns {{ items: { file: string; bytes: number }[]; totalBytes: number; limitBytes: number; withinBudget: boolean }}
 */
export function summarizeBundle({ files, sizeOf, limitBytes }) {
  const items = files.map((file) => ({ file, bytes: sizeOf(file) }));
  const totalBytes = items.reduce((sum, i) => sum + i.bytes, 0);
  return { items, totalBytes, limitBytes, withinBudget: totalBytes <= limitBytes };
}

/** @param {number} bytes */
const kb = (bytes) => (bytes / 1024).toFixed(1);

function main() {
  const root = process.cwd();
  /** @param {string} p */
  const readJson = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
  const manifest = readJson('.next/build-manifest.json');
  const config = readJson('.size-limit.json');
  const limitKB = Number(config[0].limitKB);
  /** @type {string[]} */
  const files = [...(manifest.rootMainFiles ?? []), ...(manifest.polyfillFiles ?? [])];
  // Fail LOUD rather than silently pass at 0 KB if the manifest shape drifts (e.g. a
  // bundler change empties rootMainFiles) — a fake 0 KB would defeat the whole budget.
  if (files.length === 0) {
    console.error(
      '❌ build-manifest had no first-load JS (rootMainFiles/polyfillFiles empty).\n' +
        '   Did `next build` run, and does the manifest shape still match this check?',
    );
    process.exit(1);
  }
  /** @param {string} file */
  const sizeOf = (file) => gzipSync(readFileSync(resolve(root, '.next', file))).length;

  const report = summarizeBundle({ files, sizeOf, limitBytes: limitKB * 1024 });
  for (const i of report.items) console.log(`  ${kb(i.bytes).padStart(7)} KB  ${i.file}`);
  const totalKB = kb(report.totalBytes);
  if (!report.withinBudget) {
    console.error(
      `❌ first-load JS ${totalKB} KB exceeds the ${String(limitKB)} KB budget.\n` +
        `   Trim the bundle, or raise the limit in .size-limit.json WITH a justification.`,
    );
    process.exit(1);
  }
  console.log(`✅ first-load JS ${totalKB} KB is within the ${String(limitKB)} KB budget.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
