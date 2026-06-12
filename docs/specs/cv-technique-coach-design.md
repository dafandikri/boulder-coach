# CV/ML Technique Coach — Design Spec (BC-24)

**Date:** 2026-06-13
**Status:** Draft (design only) — **not scheduled for implementation.** BC-24 is P3/future; the PO has
said focus on P1/P2 first. This spec exists so that when a milestone _does_ schedule it, the design
work is done and grounded in evidence — **no app code until then.**
**Author:** Claude Opus 4.8
**Evidence base:** [`../research/2026-06-13-computer-vision-climb-analysis-feasibility.md`](../research/2026-06-13-computer-vision-climb-analysis-feasibility.md)
(9 sources). Read it first — this spec assumes its findings.

## Problem

The app closes the warm-up → adaptive program → load → injury loop, but the v1 non-goals explicitly
deferred **video/technique form-checking** (see the design spec of record). A climber plateaus as much
on _technique_ (sloppy feet, over-gripping, hips off the wall, no weight shift) as on load — and the
app currently has no way to see or coach movement. The PO goal (2026-06-13) is to add a feature that
_analyzes a climb and gives technique advice_.

## Goal (this feature)

Let a climber **film a boulder attempt on their phone and get back a short, honest, rule-based
technique read** — which concrete movement errors occurred, when, and what to try — feeding the same
supportive-coach voice and insights loop the rest of the app already uses.

### Non-goals (stated, with the reason — these are the over-claim traps)

- **A general "optimal technique" coach.** No source delivers this; "optimal" has no ground truth for
  a given body on a given route. We coach _named, bounded errors_, not optimality.
- **Fine hand/finger technique from one camera.** Hands occlude behind the torso; handhold keypoints
  are the least reliable (The Way Up: footholds ≫ handholds). Out of MVP scope.
- **Hold-aware analysis** ("you skipped the better foothold"). Needs a per-gym hold detector that
  doesn't generalise (BoulderVision, UCSD). This is the XL tail, deferred to a later slice.
- **Auto-changing the program from video.** Technique flags are _advisory_; they must **never** feed
  `adaptation.ts`/`loadMetrics.ts` or bypass the injury-safety rule table.

## Decisions

| Decision            | Choice                                                                                                       | Rationale                                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Scope               | **MVP = occlusion-robust beginner-error flags** (L slice of the XL PBI); hold-awareness deferred             | Matches what single-camera work reliably delivers; avoids over-claim.                                        |
| Inference location  | **On-device, in-browser (MediaPipe Tasks Pose Landmarker, WASM/WebGPU)**                                     | Privacy-first (video never leaves the device — the app has never sent data off-device), offline, zero cost.  |
| Where logic lives   | **Pure `src/domain/technique.ts`** (keypoints → flags + CoM path + moves); capture glue thin in `src/app/**` | Honors the architecture invariant; testable to the per-file coverage bar with JSON fixtures, no video in CI. |
| Error model         | **Reuse PMC10574944's six geometric beginner-error rules**, restricted to the occlusion-robust subset        | Published, validated rules (P/R reported); don't reinvent.                                                   |
| Move segmentation   | **Angular-velocity peak detection** over a smoothed limb-motion signal                                       | UCSD showed it matches ground-truth move counts; cosine-similarity-between-frames over-counts badly.         |
| Occlusion handling  | **Gate every rule on per-landmark `visibility`**; discard low-visibility keypoints                           | UCSD's key failure was MediaPipe _hallucinating_ an occluded limb → phantom keypoint → false flag.           |
| Optional narration  | **Defer to BC-42** (AI weekly review), layered only on the numeric findings                                  | Keeps the LLM out of the safety path; reuses an existing planned seam.                                       |
| Safety relationship | **Advisory only** — technique flags never write to the adaptation/load engine                                | Injury decisions stay in the transparent, fuzz-tested rules engine.                                          |

### Pose runtime: on-device (WASM) vs a Python service — why, and why it's reversible

Python is the natural CV/ML language and **every source in the research used it** (UCSD, Plymouth,
BoulderVision). So this decision is a deliberate tradeoff, not a default — and it splits by context:

- **App MVP → on-device wins, for three constraints specific to _this_ app, not CV in general:**
  1. **Zero backend today.** The app is a static Next.js PWA on Vercel — no server, no DB, no env
     vars, all state in IndexedDB. A pose service adds a server to run/pay for, an upload pipeline,
     GPU (frame-by-frame pose is heavy), CORS, and eventually auth — a category jump, not an
     increment.
  2. **Privacy is load-bearing.** The design spec of record promises _video never leaves the device_.
     Climbing video is biometric/personal; a service breaks the app's one standing architectural
     commitment.
  3. **Offline.** "Installable PWA you open at the gym" + bad gym wifi → on-device runs without
     signal; a service doesn't.
- **A Python service wins (or is mandatory) when:** you need heavier/more-accurate pose (ViTPose-L
  86.6% vs MediaPipe 83.5%), **hold-aware features** (gym-specific detector training = Roboflow/
  Python — the XL tail), or you're doing the **undergraduate thesis** (no app constraints apply;
  Python gives mmpose/ultralytics + `sklearn`/`pandas` for the P/R evaluation). **For the thesis,
  use Python** — don't fight the ecosystem.

**Why this is a reversible, swap-the-source decision — not a fork:** browser-WASM MediaPipe and
Python MediaPipe emit the **same 33 landmarks**. The design puts the seam at **`KeypointFrame[]`** (a
plain serialisable array) precisely so pose-runtime is decoupled from analysis. The six-error rules
are geometry on keypoints — pure functions that don't care whether the keypoints came from WASM or a
`.py` service. So the realistic shape is a **hybrid**: start on-device for the MVP; add/swap a Python
path later for ViTPose accuracy or hold-awareness **without redesigning**. (Note: Vercel now runs
Python natively via Fluid Compute, so the service needn't be separate ops — but pose-per-frame is
CPU-heavy and serverless bills active-CPU with no GPU, so it suits the thesis/occasional use more than
a free always-on app feature.)

## Architecture

Same layering as the app; the new logic is pure domain, the messy I/O is isolated in the app layer.

```
UI  — new /technique route (PWA)
   • capture/upload a clip → run MediaPipe in-browser → per-frame keypoints
   • render skeleton overlay + flag timeline + CoM path + a short text read
──────────────────────────────────────────────────────────────────────────
App lib (gate-blind glue, kept thin)
   • src/app/lib/pose/captureKeypoints.ts  — drive MediaPipe, emit typed KeypointFrame[]
                                              (NO analysis logic here — it just produces data)
──────────────────────────────────────────────────────────────────────────
Domain (pure TypeScript, no I/O, no Date.now — testable, the contribution surface)
   • src/domain/technique.ts
       segmentMoves(frames)        → Move[]            (angular-velocity peaks)
       centerOfMassPath(frames)    → Point[]           (weighted joint mean per frame)
       detectFlags(frames, moves)  → TechniqueFlag[]   (the six-error subset, visibility-gated)
       summariseTechnique(flags)   → string[]          (1–3 templated coach sentences)
   • src/domain/types.ts  → KeypointFrame, Landmark{x,y,z,visibility}, Move, TechniqueFlag
```

### Data types (illustrative — pure, serialisable, no `any`)

```ts
// landmark visibility ∈ [0,1]; rules MUST skip landmarks below VISIBILITY_MIN
interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}
interface KeypointFrame {
  tMs: number;
  landmarks: Record<LandmarkName, Landmark>;
} // LandmarkName = MediaPipe's 33-point names
interface TechniqueFlag {
  kind: 'hip-off-wall' | 'no-weight-shift' | 'foot-cut' | 'rushed-move' | 'over-reaching';
  atMs: number;
  moveIndex: number;
  detail: string;
}
```

### The occlusion-robust flag subset (MVP)

From PMC10574944's six errors, keep the ones that depend on **foot / hip / CoM** geometry (reliable
from one camera), drop the ones needing **fine arm/hand** geometry (decoupling, shoulder-relax) to a
later slice:

| Flag             | Geometric rule (on keypoints)                                 | Reliability |
| ---------------- | ------------------------------------------------------------- | ----------- |
| Hip off the wall | hip-to-wall-plane distance > threshold during a move          | High        |
| No weight shift  | hip x not over the supporting foot before the upward move     | High        |
| Foot cut         | a foot leaves the wall mid-move (both-feet-set violated)      | High        |
| Rushed move      | move duration / inter-move rest below a tempo threshold       | Medium      |
| Over-reaching    | CoM excursion vs reach distance suggests an off-balance lunge | Medium      |

> Thresholds are calibrated against a small reference set, **not** hard-coded blind — see Evaluation.
> Every rule first filters frames where the needed landmarks have `visibility < VISIBILITY_MIN`.

## UX (sketch)

1. **Capture** — "Film a go" screen: front-on, phone propped (the Belay.ai/iPad pattern), one boulder.
2. **Process** — on-device MediaPipe runs locally; a progress state while keypoints extract.
3. **Review** — playback with the skeleton overlaid, a **flag timeline** under the scrubber (tap a flag
   → jump to that move), the CoM path, and a **short read** ("Two foot-cuts on the crux move — try
   setting the foot and trusting it before you pull"). Dismissible, never alarmist.
4. **(Later, BC-42)** — an opt-in weekly narration that folds technique trends into the coach voice.

## Evaluation (this is how we avoid shipping a demo)

A technique feature without measured accuracy is a demo, not a coach (the research's recurring
finding — most sources report _zero_ honest numbers). Before this ships:

- Capture a small in-gym set (a handful of climbers, 2–3 reference routes, front-90° + one offset),
  coach-labelled per error — the gold standard.
- Report **per-flag precision/recall** (same protocol as PMC10574944, so it's comparable), and ablate
  camera angle/height (The Way Up's degradation trend).
- This evaluation **is** the undergraduate thesis framing #1 in the research doc — one body of work,
  two deliverables (the feature + its validation).

## Risks & open questions

- **On-device performance** — MediaPipe in WASM/WebGPU on a mid phone: acceptable FPS? Fallback to a
  server pipeline (Option B, ViTPose) is a later decision, and would reopen the privacy story.
- **Calibration generality** — thresholds tuned in one gym may not transfer; document the limit, keep
  thresholds data-driven.
- **CI strategy** — domain tests run on recorded `KeypointFrame[]` JSON fixtures (no video). The
  capture glue (`src/app/lib/pose`) stays gate-blind like other I/O; keep it dumb so the smell of
  "logic re-implemented in a component" never appears.

## Relationship to other PBIs

- **BC-24** — this is its design deliverable. When scheduled, consider splitting the MVP flag-engine
  into its own PBI sibling to BC-41/42/43.
- **BC-42** (AI weekly review) — the narration layer; consumes the numeric findings only.
- **Insights / `feel` model** — technique flags are a new advisory signal; they may _display_ in
  Insights but must not feed the adaptation/load engine.
