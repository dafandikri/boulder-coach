import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'tests/**/*.ts'],
    extends: [...tseslint.configs.strictTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      // Numbers in template literals are a legitimate, common idiom (indexed IDs).
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // Allow `const { id: _id, ...rest } = row` to omit fields, and _-prefixed intentional unused.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Tests legitimately assert known shape; non-null assertions are ergonomic here.
    // Domain code keeps noUncheckedIndexedAccess strictness.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  eslintConfigPrettier,
  // `.claude/worktrees/**` are full repo copies created by parallel-agent runs (Agent-tool
  // worktree isolation). They are not gitignored, so `eslint .` would lint those sibling
  // checkouts and a local pre-push gate fails on code that isn't in the branch being pushed.
  // Ignoring them keeps the LOCAL gate honest; CI runs in a clean checkout with no worktrees.
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'coverage/**',
    'e2e/**',
    '.claude/worktrees/**',
    // Stryker (BC-35) writes sandbox copies with `@ts-nocheck` headers under .stryker-tmp;
    // linting them would fail the gate on generated mutants, not source. CI runs mutation
    // as a separate job, so the temp dir never exists during the quality job's eslint.
    '.stryker-tmp/**',
  ]),
]);

export default eslintConfig;
