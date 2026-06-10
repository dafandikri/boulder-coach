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
        'src/domain/**': { lines: 95, branches: 90, functions: 95, statements: 95 },
        global: { lines: 90, branches: 80, functions: 90, statements: 90 },
      },
    },
  },
});
