# Operations Runbook — Boulder Coach

**Audience:** whoever is on call for this app — including a future agent or engineer who has never
seen the setup. If you can read this, you can deploy it, roll it back, watch it, and recover it.

> **Why this file exists.** Boulder Coach is a client-only PWA with **no backend, no env vars, no
> `vercel.json`** — so "operations" here is not server-tending. It is the SRE discipline that survives
> regardless of stack: a reproducible deploy, a one-click rollback, an honest monitoring story, and an
> incident path a stranger can follow. The system already works; this file makes it **operable**.

---

## 1. Access & URLs

| What                 | Where                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| Production app       | https://boulder-coach-gamma.vercel.app (installable PWA over HTTPS)              |
| Vercel project       | `erdafas-projects/boulder-coach` (linked via `.vercel/project.json`, gitignored) |
| Source repo          | this repository; `main` is protected (PR + green `quality` CI required)          |
| Analytics dashboard  | Vercel project → **Analytics** tab (traffic)                                     |
| Web Vitals dashboard | Vercel project → **Speed Insights** tab (LCP/CLS/INP from real users)            |
| CI                   | GitHub Actions → `quality`, `playwright`, `lighthouse`, `mutation` jobs          |

There are **no application secrets**. All user data lives on the user's device (Dexie/IndexedDB);
nothing is stored server-side, so there is no database to access, back up, or rotate credentials for.

## 2. Deploy

A change reaches production through the gate, not around it:

1. Branch from `main`, implement, get `pnpm gate` green locally.
2. Open a PR. CI runs the `quality` gate + `playwright` (e2e incl. a11y + offline) + `lighthouse` +
   `mutation` (safety files). `main` is protected — these must pass.
3. Merge to `main`. Vercel is connected to the repo and **auto-deploys** the connected branch.

**Manual deploy (rarely needed — e.g. CLI hotfix):**

```bash
pnpm dlx vercel@latest login                                 # interactive, GitHub OAuth (first time)
pnpm dlx vercel@latest link --yes --project boulder-coach    # writes .vercel/ (gitignored)
pnpm dlx vercel@latest deploy --prod --yes
```

**Why zero-config:** Vercel auto-detects Next.js + pnpm. The app is fully client-side, so there are no
environment variables and no `vercel.json`/`vercel.ts` to maintain. Reintroducing either is a
**conscious decision** (see BC-57 in `docs/BACKLOG.md`), not a default.

## 3. Rollback

Production rollback is **instant and does not require a rebuild** — promote the previous good
deployment:

- **Dashboard:** Vercel project → **Deployments** → pick the last-known-good build → **Promote to
  Production** (or the **Instant Rollback** action).
- **CLI:** `pnpm dlx vercel@latest rollback <deployment-url>`.

**Service-worker caveat:** `public/sw.js` is **network-first for navigations**, so a rollback reaches
online users on their next load without a cache purge. Only a release that must force-purge the cached
app shell needs a `CACHE` version bump in `public/sw.js` — note that in the PR if so.

## 4. Monitoring — what's watched and where to look

This is the honest "monitoring/uptime" answer for a static PWA: there is no server process to
heartbeat, so monitoring is **delivery health + real-user experience + release-quality budgets**, all
already wired:

| Signal                         | Tool                                                     | Tells you                                             | Where                   |
| ------------------------------ | -------------------------------------------------------- | ----------------------------------------------------- | ----------------------- |
| Traffic / usage                | `@vercel/analytics` (`layout.tsx`)                       | Are people using it; which routes                     | Vercel → Analytics      |
| Real-user Web Vitals           | `@vercel/speed-insights` (`layout.tsx`)                  | LCP / CLS / INP from actual devices                   | Vercel → Speed Insights |
| Lab performance + a11y budgets | Lighthouse CI (`lighthouserc.json`, `pnpm lighthouse`)   | Per-category regressions, by number                   | `lighthouse` CI job     |
| Shipped JS size                | bundle-size gate (`.size-limit.json`, `pnpm bundlesize`) | The PWA stays light on gym data                       | `pnpm gate` step 9/9    |
| Offline / installability       | Playwright e2e (`e2e/offline.spec.ts`)                   | SW registers, app loads offline, manifest installable | `playwright` CI job     |
| Uptime                         | Vercel platform (static edge hosting)                    | Hosting availability                                  | Vercel status           |

**Routine check (post-deploy or weekly):** open Speed Insights for a vitals regression, glance at
Analytics for a traffic cliff, confirm the latest CI run is green.

## 5. Incident response

Stay blameless and transparent. Symptom → check → action:

| Symptom              | Check                                                                                    | Action                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| White / blank screen | Did a render error fire? `error.tsx` / `global-error.tsx` show a branded recovery screen | User can reload / export (BC-33). If it reproduces, **roll back** (§3), then fix forward                            |
| App feels slow       | Speed Insights (real users) + bundle-size gate trend                                     | Identify the heavy route/dep; the bundle gate fails the PR by number if JS crept                                    |
| "I lost my data"     | Data is on-device (IndexedDB). Persistence requested via BC-31; export/import is BC-10   | Walk the user through **import from their last export**; confirm `navigator.storage.persist()` returned `persisted` |
| Bad release          | Vercel Deployments list                                                                  | **Instant rollback** to last-known-good (§3); open a fix PR                                                         |
| CI red on `main`     | GitHub Actions logs for the failing job                                                  | Fix forward via PR — never push past a red gate (`main` is protected)                                               |

There is no crash-telemetry backend today, so the developer does **not** automatically see a
production crash — see §6.

## 6. Known limitations & next steps

Honest gaps (the section the SRE rubric rewards):

- **No crash visibility.** `error.tsx` / `global-error.tsx` only `console.error` on the _user's_
  device — production crashes are invisible to the developer. Adding telemetry is **deliberately
  deferred** (BC-57) until there's a real user base, because it fights three invariants: privacy
  (local-first health data), the 200 KB bundle budget (Sentry SDK ~30–50 KB), and the no-env-var
  posture. Revisit when traffic justifies it; scrub all health/injury data from any payload.
- **No synthetic uptime probe.** Vercel hosts the static shell; if a probe is ever wanted, a free
  external pinger against the production URL is the lightest option (no code, no bundle cost).
- **No multi-device durability.** Data is single-device until cloud sync (BC-18) lands; the current
  durability story is persistent storage (BC-31) + manual export (BC-10) + the backup nudge (BC-34).

See [`docs/BACKLOG.md`](BACKLOG.md) for the tracked items and [`skills/operating-and-deploying.md`](../skills/operating-and-deploying.md)
for the reusable "is this ops change actually done?" checklist.
