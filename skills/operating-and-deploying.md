---
name: operating-and-deploying
description: Read BEFORE shipping or changing how Boulder Coach is deployed, rolled back, or monitored. The operability discipline — reproducible deploy, one-click rollback, an honest monitoring story, and a runbook a stranger can follow — applied to a backendless Vercel PWA.
---

# Operating & deploying Boulder Coach

An ops change is not done when "it works" — it's done when the **next on-call engineer (or agent) who
has never seen your setup** can deploy it, roll it back, watch it, and recover from an incident using
only what's written down. That second half is half the grade in real SRE work, and it's exactly what a
green `pnpm gate` cannot check. The live operations facts live in [`../docs/RUNBOOK.md`](../docs/RUNBOOK.md);
this skill is the reusable _procedure_ for keeping that true.

## Why this app's "ops" is unusual

Boulder Coach is a **client-only PWA**: no backend, no env vars, no `vercel.json`, all data on-device
in IndexedDB. So operability is not server-tending. It is four things, and each must stay honest:

1. **Reproducible deploy** — a change reaches prod the same way every time (PR → green CI → merge →
   Vercel auto-deploy). No snowflake manual steps that only you know.
2. **One-click rollback** — a bad release is recoverable in seconds (Vercel instant rollback / promote
   previous deployment), without a rebuild.
3. **An honest monitoring story** — name what you actually watch (traffic, real-user Web Vitals,
   Lighthouse + bundle budgets, offline e2e) and where. Don't claim observability you don't have; don't
   skip it because there's no server.
4. **A runbook a stranger can follow** — access URLs, deploy, rollback, incident table, and the honest
   gaps, all written down before you call it done.

## Before you call an ops change done

- [ ] **Deploy is reproducible** — the path is the standard PR → CI → merge → auto-deploy, or a single
      documented command. No undocumented manual step.
- [ ] **Rollback still works** — you can name the exact action (promote previous deployment, or
      `vercel rollback`) and any caveat (e.g. a `CACHE` bump in `public/sw.js` only when you must
      force-purge the app shell).
- [ ] **Monitoring is checked, not assumed** — after a deploy, glance at Speed Insights for a vitals
      regression and Analytics for a traffic cliff; confirm the latest CI run is green.
- [ ] **The runbook is current** — if your change altered deploy, rollback, monitoring, or the incident
      path, update [`../docs/RUNBOOK.md`](../docs/RUNBOOK.md) **in the same commit** (doc discipline).
- [ ] **Limitations are honest** — record any gap (no crash telemetry yet → BC-57) rather than implying
      coverage you don't have. Flagging a gap beats hiding it.

## Invariants you must not break

- **No secrets, no env vars, no `vercel.json`** unless it's a _conscious, documented_ decision — the
  local-first, zero-config posture is a selling point, not an accident (see BC-57's three constraints:
  privacy, the 200 KB bundle budget, the no-backend posture).
- **Never push past a red gate.** `main` is protected; every change reaches it via a PR with green
  `quality` CI. Roll back or fix forward — never around.
- **Scrub health/injury data** from anything that ever leaves the device. If you ever add telemetry,
  the privacy-scrub is a testable contract, not a hope.

## Red flags

| Thought                                    | Reality                                                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| "It deploys fine on my machine"            | A deploy only one person can do is an outage waiting to happen. Document it.                                           |
| "There's no server, so nothing to monitor" | You still have real-user vitals, traffic, bundle size, and offline health. Name them.                                  |
| "I'll write the runbook later"             | Later is during the incident, at 2am, by someone who isn't you. Write it now.                                          |
| "Just add Sentry"                          | That's an env var + ~30–50 KB bundle + a privacy surface on local-first health data. It's deferred (BC-57) on purpose. |
