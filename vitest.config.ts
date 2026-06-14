import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Match the `@/*` -> src/* alias from tsconfig so value imports resolve in tests.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // vitest v4 exits 1 on "no test files"; keep the gate green until real tests exist.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/domain/**', 'src/data/**', 'src/app/lib/**'],
      thresholds: {
        // perFile: every individual file must clear the bar — a 100%-covered
        // sibling can no longer mask a weak file on the aggregate (e.g. schedule.ts
        // once sat at 75% branch behind 100% neighbours). See docs/LEARNINGS.md
        // 2026-06-10 (unreachable branch) and skills/universal-quality-bar.md.
        perFile: true,
        'src/domain/adaptation.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/domain/loadMetrics.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
        // Floors ratcheted 2026-06-14 to capture existing headroom (measured global
        // branch 98.69% vs the old 80% floor). Each floor sits BELOW the lowest real
        // file with margin so no file flakes; ratchet up, never down. The domain
        // branch floor is held at 92 (not 95) by periodization.ts's two rest-day
        // `default` guards (93.18% branch) — reachable in principle but never fed
        // 'rest' by sessionPlanFor, so kept as defensive code rather than covered
        // with a type cast. See docs/LEARNINGS.md 2026-06-14.
        'src/domain/**': { lines: 95, branches: 92, functions: 95, statements: 95 },
        global: { lines: 95, branches: 95, functions: 95, statements: 95 },
      },
    },
  },
});
