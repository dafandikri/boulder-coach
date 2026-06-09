# Boulder Coach

An adaptive bouldering training app (Next.js PWA) **plus** the AI-first development harness that
builds and maintains it. The app tells an intermediate (V4–V6) gym climber exactly what to train
today, adapts to performance and how they feel, and keeps them out of injury.

- **App design spec:** `docs/specs/2026-06-09-bouldering-coach-app-design.md`
- **Harness design spec:** `docs/specs/2026-06-09-ai-harness-design.md`
- **Plans:** `docs/plans/`
- **Learnings ledger:** `docs/LEARNINGS.md`

---

## Quick start

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm gate       # run the full quality gate (must be green before any commit)
pnpm test       # vitest (domain) ;  pnpm e2e  for Playwright smoke
```

## System architecture

Layered, with pure domain logic decoupled from storage and UI:

```
UI        — Next.js App Router (PWA): Today screen, check-in, session player
─────────────────────────────────────────────────────────────────────────
Domain    — pure TypeScript, NO I/O (testable in isolation)
  • loadMetrics   sRPE, acute/chronic, ACWR
  • warmup        RAMP warm-up generator
  • periodization 6-week waved program
  • adaptation    safety-first rules engine (adjusts today's session)
─────────────────────────────────────────────────────────────────────────
Repository — IClimbRepo interface (the only storage seam)
  └ DexieClimbRepo (IndexedDB) now → cloud impl later, domain untouched
```

The layering is **enforced automatically** by `dependency-cruiser`: `src/domain` may not import from
`src/data` or `src/app`. A wrong import fails the gate.

## The AI harness (infra)

Production-grade, automated quality enforcement so AI agents (and humans) can only commit correct
work. One deterministic gate, four enforcement tiers, a safety reviewer, and a learning ledger.

**Tool-agnostic by design.** The enforcement is plain shell + git + GitHub — it works the same whether
you use Claude Code, OpenCode, Codex, Cursor, Aider, or hand-code. `AGENTS.md` is the cross-tool
instruction file every agent reads; `.claude/` is optional Claude Code convenience. **The gate is the
contract.** See [`CONTRIBUTING.md`](CONTRIBUTING.md).

### The gate (`scripts/gate.sh`) — single source of truth

Runs fast-to-slow; exit code is law:

| #   | Step             | Tool                                                           |
| --- | ---------------- | -------------------------------------------------------------- |
| 1   | format           | Prettier `--check`                                             |
| 2   | lint             | ESLint (typescript-eslint **strict-type-checked**, bans `any`) |
| 3   | typecheck        | `tsc --noEmit` (strict)                                        |
| 4   | architecture     | dependency-cruiser (layering: domain ↛ data ↛ app)             |
| 5   | type-coverage    | `type-coverage --at-least 99`                                  |
| 6   | tests + coverage | Vitest v8 (safety files = 100% branch)                         |
| 7   | dead-code        | Knip                                                           |
| 8   | build            | `next build`                                                   |

### Four enforcement tiers (defense in depth)

1. **In-loop** — orchestrator runs `pnpm gate` per task before commit.
2. **Pre-commit** (`.husky/pre-commit`) — lint-staged (format + lint) + `tsc` on staged files.
3. **Pre-push** (`.husky/pre-push`) — full `pnpm gate`.
4. **CI** (`.github/workflows/ci.yml`) — full gate + Semgrep + Playwright on push/PR.

### Safety net

- **`safety-rule-reviewer`** agent (`.claude/agents/`) reviews every change to `adaptation.ts` /
  `loadMetrics.ts` against the canonical injury-safety rule table. On deviation the loop **stops**.
- **`domain-rule-authoring`** skill (`.claude/skills/`) injects the canonical ACWR math + rule table
  so safety logic is implemented from source, not paraphrase.
- **Git guardrails** (`.claude/settings.json`): `git push` / `gh pr create` are denied to agents;
  a Stop-gate hook blocks "done" claims while the gate is red. Nothing leaves the machine without a human.

### Learning ledger + autonomous loop

- **Ledger** (`docs/LEARNINGS.md`): every gate failure → root cause → fix → prevention.
  Recurring failures (≥2×) get **promoted** into automated checks.
- **Loop** (`.claude/LOOP.md`): plan-agnostic protocol — fresh subagent per task → gate → safety
  review on domain files → ledger on failure → feedback retry ≤3 → local commit. Never pushes.

## Documentation discipline

On any **substantial** change to infra, design, or system behavior, update the relevant docs **in the
same commit**: this `README.md`, `AGENTS.md`, `CLAUDE.md`, and the specs in `docs/`.
Docs are part of "done" — see `AGENTS.md` → "Documentation discipline".

## Scripts

| Script                                      | Purpose                                 |
| ------------------------------------------- | --------------------------------------- |
| `pnpm gate`                                 | Full quality gate (the source of truth) |
| `pnpm dev` / `build` / `start`              | Next.js                                 |
| `pnpm test` / `test:watch`                  | Vitest domain tests                     |
| `pnpm e2e`                                  | Playwright smoke                        |
| `pnpm lint` / `format` / `format:check`     | ESLint / Prettier                       |
| `pnpm depcruise` / `type-coverage` / `knip` | Static analysis                         |

## Tech stack

Next.js 16 (App Router) · TypeScript (strict) · Tailwind v4 · Dexie (IndexedDB) · Vitest · Playwright
· ESLint strict-type-checked · Prettier · dependency-cruiser · type-coverage · Knip · Semgrep ·
Husky + lint-staged · GitHub Actions · pnpm.
