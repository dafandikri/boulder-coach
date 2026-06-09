import { defineConfig } from 'vitest/config';

export default defineConfig({
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
        'src/domain/adaptation.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/domain/loadMetrics.ts': { lines: 100, branches: 100, functions: 100, statements: 100 },
        'src/domain/**': { lines: 95, branches: 90, functions: 95, statements: 95 },
        global: { lines: 90, branches: 80, functions: 90, statements: 90 },
      },
    },
  },
});
