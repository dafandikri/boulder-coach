// BC-14 — generate branded maskable PWA icons from the brand hold-mark. Reproducible
// (run `pnpm icons`) so the raster assets are never hand-edited binaries of unknown
// origin. Full-bleed chalk background (no transparent corners) with the hold art inside
// the maskable safe zone, rasterised to the sizes the manifest + iOS need.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const HOLD_ART = `
  <g transform="translate(8 8) scale(0.48)">
    <path d="M52 7 C75 4 95 21 95 45 C95 69 80 93 54 94 C29 95 7 81 6 55 C5 31 28 11 52 7 Z" fill="#ff6a39"/>
    <path d="M52 7 C75 4 95 21 95 45 C95 69 80 93 54 94 C29 95 7 81 6 55 C5 31 28 11 52 7 Z" fill="none" stroke="#2a2233" stroke-width="4"/>
    <ellipse cx="40" cy="56" rx="8" ry="11" fill="#2a2233" opacity="0.85" transform="rotate(-12 40 56)"/>
    <ellipse cx="60" cy="60" rx="7" ry="10" fill="#2a2233" opacity="0.8" transform="rotate(10 60 60)"/>
  </g>
  <circle cx="49" cy="16" r="4" fill="#ffc63d" stroke="#2a2233" stroke-width="2"/>`;

/** A full-bleed (maskable-safe) brand tile at the given pixel size. */
function maskableSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}"><rect width="64" height="64" fill="#fff7ed"/>${HOLD_ART}</svg>`;
}

const TARGETS = [
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
];

async function main() {
  for (const { file, size } of TARGETS) {
    await sharp(Buffer.from(maskableSvg(size)))
      .png()
      .toFile(file);
    console.log(`✓ ${file} (${String(size)}×${String(size)})`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
