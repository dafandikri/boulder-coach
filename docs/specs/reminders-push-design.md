# Reminders that fire when the app is closed — Web Push design (BC-58)

**Date:** 2026-06-16
**Status:** Design — pending implementation plan (no app code until a milestone schedules it)
**Author:** dafandikri (PO) · drafted by Claude Opus 4.8 (brainstorming session)
**Supersedes:** BC-20's on-open nudge (kept as the no-permission fallback; see §13)
**Library facts grounded via Context7:** `web-push` (`/web-push-libs/web-push`), Vercel Cron
(`/vercel/vercel`) — see §10/§11.

---

## 1. Problem

BC-20 shipped an opt-in training-day reminder, but it only fires **when the climber opens the app**
(`shouldRemindOnOpen`, `src/app/lib/reminders.ts`). That is backwards: a reminder's entire purpose is to
pull someone back when they are **not** in the app. As shipped it delivers ~none of its intended value —
a toggle and copy with no real trigger. The PO escalated this (2026-06-16) from design-first P3 to a
buildable P2 and wants reminders that **actually fire on iOS, Android, and desktop while the app is
closed**.

## 2. Goals / Non-goals

**Goals**

- A training-day reminder is delivered while the app is **closed/backgrounded** on:
  - Android (Chrome/Edge, installed or browser tab), desktop Chromium/Firefox.
  - **iOS/iPadOS 16.4+** for an **installed (Add-to-Home-Screen) PWA** — the owner's exact case (cf.
    BC-39 install prompt, BC-61 installed-PWA polish).
- The climber's **schedule and health data never leave the device** — the server learns only an opaque
  push subscription.
- Decision logic (is today a training day? already nudged today? right local hour?) lives in **covered,
  unit-tested layers**, not buried in `public/sw.js`.
- Fits the project's near-zero-backend posture: one minimal serverless surface + a daily cron + a tiny
  anonymous subscription store. The cost/posture trade-off is made **explicit** (§9), not smuggled in.

**Non-goals (this iteration)**

- Per-user custom reminder times / multiple reminders per day (start with one morning nudge).
- Rich/actionable notifications (action buttons, images). A title + body + tap-to-open is enough.
- Global sub-hour timezone precision (covered by audience tuning + a documented scale path — §8).
- Marketing/streak/“you’re slipping” pushes — only the training-day nudge. (Re-engagement pushes are a
  future PBI; they raise consent/spam concerns out of scope here.)

## 3. The dead ends (record them so nobody retries — already in BC-58)

- **Notification Triggers API** (`showTrigger`/`TimestampTrigger`) — never standardized, removed from
  Chromium. Not an option.
- **Periodic Background Sync** — Chromium-only, throttled by site-engagement heuristics, **no iOS**.
  Unreliable as a reminder trigger.
- **A pure client-side `setTimeout`/alarm** — dies when the page/SW is evicted; cannot wake a closed app.

The only mechanism that wakes a closed PWA cross-platform is the **Push API** (a server-sent push that
the OS delivers to the Service Worker). Hence this design.

## 4. Architecture

```
CLIENT (browser / installed PWA)
  Profile toggle (reuses BC-20 opt-in)
    └─ request Notification permission
    └─ registration.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey })
    └─ POST /api/push/subscribe   { subscription }
  On profile/program change & on app open:
    └─ buildReminderPlan(profile, asOf)  →  write ReminderPlan to IndexedDB   (PURE, tested)
──────────────────────────────────────────────────────────────────────────────
SERVER (Vercel, minimal)
  POST /api/push/subscribe      → store subscription in PushSubscriptionStore (Upstash Redis)
  POST /api/push/unsubscribe    → remove it
  GET  /api/push/cron           → (CRON_SECRET-guarded) for each subscription:
                                    webpush.sendNotification(sub, "")   // content-less "wake"
                                    prune on 404/410
  Vercel Cron: one daily fire tuned to the audience morning (vercel.json `crons`)
──────────────────────────────────────────────────────────────────────────────
PUSH SERVICE (FCM / Mozilla / Apple) — opaque, delivers to the device
──────────────────────────────────────────────────────────────────────────────
SERVICE WORKER (public/sw.js)
  'push' event:
    └─ read ReminderPlan + lastShownIso from IndexedDB
    └─ pickReminderForDay(plan, localDateIso(now), lastShownIso, now.getHours())  (PURE, tested)
    └─ if it returns {title, body}:  showNotification(...) + stamp lastShownIso
       else: showNotification(silent maintenance copy)   // userVisibleOnly budget — see §12
  'notificationclick' event:
    └─ focus/open '/'   (deep-link to Today)
```

**The server never sees the schedule.** It sends a blank wake ping; the SW reads the on-device plan and
decides locally. The only thing persisted server-side is the opaque `PushSubscription` (endpoint + keys).

## 5. Components & interfaces (isolation-first)

| Unit                                                     | Home                                             | Purpose                                                                                                                                | Depends on                                   |
| -------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `buildReminderPlan(profile, asOf, horizonDays=14)`       | `src/domain/reminderSchedule.ts` (PURE)          | Precompute, per local date, whether it’s a training day and the per-session-type copy. No I/O, `asOf`-driven.                          | `programClock`, `schedule`, `reminders` copy |
| `pickReminderForDay(plan, todayIso, lastShownIso, hour)` | `src/domain/reminderSchedule.ts` (PURE)          | The SW’s decision: returns `{title, body}` to show, or `null`. Gates on training-day + not-already-shown-today + local-morning window. | —                                            |
| `subscribeToPush()` / `unsubscribeFromPush()`            | `src/app/lib/push.ts` (covered)                  | Permission + `pushManager` orchestration, `urlBase64ToUint8Array(PUBLIC_VAPID)`, POST to the API, write/refresh the IDB plan.          | repo, fetch                                  |
| `IPushSubscriptionStore`                                 | `src/data/pushStore.ts`                          | `add/remove/list` over the anonymous subscriptions. Upstash Redis impl now; swap later — mirrors the `IClimbRepo` seam philosophy.     | Upstash REST                                 |
| `/api/push/{subscribe,unsubscribe,cron}`                 | `src/app/api/push/**/route.ts`                   | Thin route handlers; logic delegated to the store + `web-push`.                                                                        | `web-push`, store                            |
| SW `push`/`notificationclick`                            | `public/sw.js`                                   | ~15-line lookup: read IDB → call the predicate → show/stamp. **No business logic.**                                                    | `pickReminderForDay` (see §7 drift guard)    |
| Reminder IDB record                                      | `src/data/dexieRepo.ts` (new store, `version+1`) | Persist `ReminderPlan` + `lastShownIso` for the SW to read. Covered by a BC-32-style migration test.                                   | Dexie                                        |

### Data shapes

```ts
// Persisted server-side — the ONLY thing that leaves the device. Opaque, pseudonymous.
interface StoredSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// Persisted on-device (IndexedDB) — never sent to the server.
interface ReminderPlan {
  days: Record<string /* localDateIso */, { show: boolean; title: string; body: string }>;
  generatedAt: string;
}
// lastShownIso: string  (separate record; the SW bumps it after showing — idempotent per day)
```

## 6. Subscribe / unsubscribe flow

- The **existing BC-20 profile toggle** becomes the single opt-in. Turning it **on**: request Notification
  permission → `subscribe()` with the VAPID public key → POST the subscription → write the initial
  `ReminderPlan`. Turning it **off**: `subscription.unsubscribe()` + POST `/unsubscribe` → clear local
  state. Persist the choice (lazy SSR-safe read, no effect `setState` — the Next 16
  `react-hooks/set-state-in-effect` rule, matching BC-39/BC-20).
- Re-subscribe defensively on app open if permission is granted but no live subscription exists (push
  subscriptions can be rotated/expired by the browser).

## 7. Keeping the SW honest (logic-in-covered-layers, even in `sw.js`)

`public/sw.js` is gate-blind (no test harness). To satisfy the repo's universal-quality-bar rule, the
**decision is `pickReminderForDay` — a pure function in `src/domain/reminderSchedule.ts` with 100% branch
tests**. The SW must call the _same_ logic. Two acceptable implementations (decide in the plan):

1. **Inline + drift guard (recommended):** the SW carries a copy of the predicate; a Tier-1 test
   (`tests/pwa/sw-reminder.test.ts`) runs the SW's inlined predicate and the canonical module over a
   shared fixture table and asserts identical output — so they can never silently diverge (the repo's
   executable-over-prose ethos; cf. the font/`docs-in-sync` guards).
2. **Build-time inline:** a tiny build step injects the compiled predicate into `sw.js`. Heavier; only if
   (1) proves brittle.

Either way the SW itself contains **no untested branch** — it reads IDB, calls the predicate, shows/stamps.

## 8. Timezone strategy (the crux)

A push shows **when it arrives**; the SW cannot defer it. So a notification reaches a climber only if a
push lands during their local morning window.

- **Now (audience-tuned, free-tier-compatible):** one daily Vercel cron at **~23:00 UTC ≈ 06:00 WIB**
  covers the Indonesian primary audience (UTC+7/8/9). `pickReminderForDay` additionally gates on a local
  **morning window** (e.g. 05:00–11:00) so a mistimed push is suppressed rather than buzzing at night.
- **Scale path (documented, not built):** broader timezone coverage = **more daily cron fires** (e.g.
  every 2–3h) so every region gets a push in its local morning; the SW's `lastShownIso` dedupe means each
  climber is still nudged **at most once per day**. More-than-once-daily crons need the **Vercel Pro**
  plan or an external scheduler (GitHub Actions / cron-job.org hitting the same `CRON_SECRET` route).
  This is a config change, not a redesign.

## 9. Privacy analysis (the explicit trade-off BC-58 flagged)

- **What leaves the device:** only `StoredSubscription` — an opaque push endpoint + its encryption keys.
  No grade, no goal, no injury history, no schedule, no logs. A subscription is **pseudonymous** (a token
  to a push service), not health data.
- **What stays on the device:** the entire `ReminderPlan` (derived from profile + program) and the
  show/skip decision. Health/training data **never** leaves the device — the local-first promise holds.
- **The honest cost:** this is the first time the app persists _anything_ server-side and the first env
  vars (VAPID + store creds). That cuts against the README's “no env vars / no backend” selling point.
  The mitigation is scope: an **anonymous** token store, opt-in only, deletable on unsubscribe, with a
  documented retention/prune policy (404/410 auto-prune + a periodic sweep). README/AGENTS updated in the
  implementing commit. **Decision: worth it** — a reminder that never reminds is dead weight; this is the
  only mechanism that delivers the feature, and the privacy envelope stays tight.

## 10. Vercel Cron (grounded via Context7)

- Configure in `vercel.json` (or `vercel.ts`): `"crons": [{ "path": "/api/push/cron", "schedule": "0 23 * * *" }]`.
- The cron dispatcher accepts **GET/POST** and strips the query string; the route reads no params.
- **Secure it:** Vercel sends `Authorization: Bearer $CRON_SECRET`; the route rejects any request whose
  header ≠ `CRON_SECRET` (env var). Prevents the public endpoint from being used to spam pushes.
- **Plan limits:** Hobby allows limited **once-daily** crons (sufficient for the audience-tuned single
  fire); more frequent schedules need Pro (the §8 scale path).

## 11. web-push server specifics (grounded via Context7 — `/web-push-libs/web-push`)

- **Keys (one-time):** `webpush.generateVAPIDKeys()` → store `publicKey` as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  (client) and `privateKey` as `VAPID_PRIVATE_KEY` (**server-only, never shipped**).
- **Configure:** `webpush.setVapidDetails('mailto:owner@…', PUBLIC, PRIVATE)`.
- **Send:** `webpush.sendNotification(subscription, "" /* blank wake */, { TTL: 24*60*60, contentEncoding: 'aes128gcm' })`.
- **Prune:** on `err.statusCode === 410 || 404` remove that subscription from the store (gone/expired);
  on `429` back off. This keeps the store self-cleaning.
- `web-push` is a Node lib → the route runs on Node runtime (Fluid Compute), not Edge.

## 12. Known limitations (state them honestly)

- **`userVisibleOnly` budget:** browsers require a push to result in a _visible_ notification; a SW that
  silently suppresses on non-training days spends a small “silent push” budget and, if exhausted, the
  browser may show its own generic “site updated” notice. Mitigation: keep cron frequency low (once
  daily) and have the SW show a **soft, useful** fallback rather than nothing on a suppressed day — or,
  better, only the audience-morning fire means most pushes land on intended days. Documented; revisit if
  users report generic notices.
- **iOS:** Web Push works **only for an installed PWA on iOS 16.4+** (not Safari tabs). The toggle copy
  must tell iOS users to Add to Home Screen first (ties to BC-39/BC-61).
- **Permission denial:** if the user blocks notifications, fall back to BC-20's on-open nudge (no
  regression) and the toggle reflects the blocked state.

## 13. Relationship to BC-20

BC-20 stays as the **no-permission / unsupported fallback** (it already nudges on app-open). When push is
subscribed, push is the primary trigger; BC-20's on-open fire is suppressed if a push already nudged today
(`lastShownIso` shared). No code from BC-20 is deleted — it degrades gracefully.

## 14. Testing strategy

- **Pure (vitest, per-file coverage):** `buildReminderPlan` (training/rest days across a mesocycle,
  horizon windowing, copy per `SessionType`); `pickReminderForDay` (training-day yes/no, already-shown
  dedupe, morning-window gate, cold-start empty plan) — branch-complete.
- **SW drift guard:** `tests/pwa/sw-reminder.test.ts` asserts the SW's inlined predicate ≡ the module over
  a fixture table (§7).
- **API routes:** subscribe/unsubscribe with a **mocked `IPushSubscriptionStore`** (add/remove/idempotent
  re-subscribe); cron route with a mocked `web-push` asserting one send per subscription and **prune on
  404/410**; `CRON_SECRET` rejection test.
- **Migration:** a BC-32-style `version(n)→(n+1)` test proving the new reminder store preserves existing
  rows.
- **e2e/manual matrix (documented, not all automatable):** installed PWA on iOS 16.4+ and Android Chrome
  receives a training-day notification **while closed**; tapping it opens Today. CI can assert the SW
  registers a `push` listener and the manifest/permission plumbing (extends the BC-16 offline e2e).

## 15. Environment & provisioning

| Var                            | Scope  | Source                                                     |
| ------------------------------ | ------ | ---------------------------------------------------------- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client | `generateVAPIDKeys()` once                                 |
| `VAPID_PRIVATE_KEY`            | server | `generateVAPIDKeys()` once                                 |
| `VAPID_SUBJECT`                | server | `mailto:` owner                                            |
| `CRON_SECRET`                  | server | Vercel-generated                                           |
| Upstash Redis creds            | server | **Vercel Marketplace → Upstash Redis** (auto-injected env) |

The dep-placement guard (BC-26) must keep `web-push` in **production** `dependencies` (it runs in the
route) and any `@types/web-push` in dev — add a test note so the guard isn't tripped.

## 16. Decisions log (alternatives weighed)

| Decision                 | Choice                                 | Why not the alternative                                                                                                                     |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Wake mechanism           | **Web Push API**                       | Notification Triggers (removed), Periodic Background Sync (Chromium/no-iOS), client timers (die when evicted) all fail closed-app delivery. |
| Who decides what to show | **Service Worker, from on-device IDB** | Server-side scheduling would require storing the schedule (health-adjacent) → breaks local-first.                                           |
| Subscription store       | **Upstash Redis (Marketplace)**        | Postgres/Neon = heavier for an opaque token set; Edge Config = read-optimized, bad for sub/unsub writes; Blob = write races.                |
| Push payload             | **Blank wake; SW composes copy**       | Sending the title server-side would leak the (benign) schedule and needs the schedule server-side anyway.                                   |
| Provider                 | **Standard Web Push + VAPID**          | FCM-direct = vendor lock + Google project; standard protocol reaches all browsers’ push services.                                           |
| Cron cadence             | **One daily, audience-tuned**          | Global sub-hour precision needs Pro/external scheduler — deferred as a config scale path, not a redesign.                                   |

## 17. Scope boundary for the implementation PBI

This spec is the **design-only** deliverable BC-58 asked for. The implementing PBI (when a milestone
schedules it) should land in vertical slices to keep each gate-green:

1. **Pure core:** `reminderSchedule.ts` (`buildReminderPlan` + `pickReminderForDay`) + tests. No I/O — fully
   gateable on its own.
2. **Store + API:** `IPushSubscriptionStore` + Upstash impl + the three routes + `web-push` + cron config,
   with mocked-store tests and the `CRON_SECRET` guard.
3. **Client + SW:** profile-toggle subscribe/unsubscribe, IDB plan write + migration, `sw.js` push/click
   handlers + the drift guard, README/AGENTS env + privacy docs.

Each slice is independently reviewable; slice 1 has no backend and could even ship first behind the
existing toggle.

## 18. Open questions for the PO (carry into the plan)

- **Plan tier:** stay Hobby (single daily fire, Indonesia-only morning coverage) or budget Vercel Pro for
  multi-fire global coverage at launch? (Recommendation: Hobby now, audience-tuned; revisit on expansion.)
- **Suppressed-day copy:** on a non-training day that a push still lands, prefer a soft useful notice
  (“Rest day — your fingers are repairing 💪”) over silence, to stay inside the `userVisibleOnly` budget?
  (Recommendation: yes — it’s on-brand and avoids the generic browser notice.)
