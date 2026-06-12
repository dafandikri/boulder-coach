# Research — Computer-vision climb analysis & technique coaching: feasibility + thesis assessment

**Date:** 2026-06-13 · **Author:** Claude Opus 4.8 (product/research session)
**Trigger:** PO goal — "add a feature of computer vision to analyze your climb and give advice and
give optimal technique. Research if it's possible. And research how good it is as an undergrad thesis
topic." Nine seed sources supplied (see References).
**Purpose:** decide (a) whether a CV "film your climb → technique feedback" feature is buildable for
Boulder Coach, at what scope and cost, and (b) whether the same work is a strong undergraduate thesis.

> This is a **findings document**, not a spec. The design spec of record stays
> [`specs/2026-06-09-bouldering-coach-app-design.md`](../specs/2026-06-09-bouldering-coach-app-design.md).
> Nothing here weakens the injury-safety rule table. CV is a **new analysis surface**, not a change to
> `adaptation.ts`/`loadMetrics.ts`. It maps most closely to the existing vision PBIs **BC-41/42/43**.

---

## TL;DR

- **Is it possible? Yes — and repeatedly demonstrated.** Markerless pose estimation from a single
  phone camera is a solved-enough primitive (MediaPipe / YOLOv8-pose / ViTPose all run on consumer
  hardware). At least one commercial app (Belay.ai), one open-source project (ClimbingCoach), a
  Roboflow reference build (BoulderVision), a published undergraduate paper (Plymouth), and a
  peer-reviewed iPad system (Pavllo-style skeleton analysis) all do versions of it. **§1**
- **The hard part is not pose — it's turning a skeleton into trustworthy _coaching_.** Every source
  hits the same three walls: **occlusion** (hands/feet hidden behind the torso), **generalisation**
  (a hold detector trained on one gym fails on another colour scheme/wall angle), and **validation**
  (almost nobody reports honest accuracy on _advice quality_, only on detection). **§2**
- **For the app:** a thin **MVP is realistic** (upload a clip → overlay skeleton + 3–5 rule-based
  technique flags + center-of-mass path). A _general_ "optimal technique" coach is **not** realistic
  for a solo project and would over-promise. Scope it like the published work did. **§3**
- **As an undergrad thesis: strong — arguably ideal.** It's already been done at exactly that level
  (Plymouth Student Scientist), the field has fresh 2024–2025 datasets and an explicit, surveyed
  research gap, and it cleanly separates "engineering deliverable" from "evaluated research
  question." Pick _one_ narrow, measurable contribution. **§4** + **§5**

---

## 1. Is it possible? What the sources actually built

| Source                                          | What it is                                  | Pose method                         | Hold detection                                                                    | Feedback produced                                                               | Honest accuracy reported?                    |
| ----------------------------------------------- | ------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- |
| **tjtl.io blog**                                | Hobbyist exploration                        | MediaPipe 3D                        | manual/none                                                                       | CoM path, velocity vectors, success-vs-fail trajectory overlays                 | No (qualitative)                             |
| **ClimbingCoach** (GitHub, ZeTioZ)              | Open-source AR app                          | YOLO pose                           | YOLO holds — **97.2% mAP** on its dataset                                         | route creation, move sequence, completion %, distance, move count, timing       | Detection only                               |
| **BoulderVision** (Roboflow)                    | Reference workflow                          | YOLOv8x-pose                        | custom detect + colour classify                                                   | duration, vertical path, "velocity ratios", rest heatmap, decisive transitions  | **No metrics**                               |
| **Belay.ai**                                    | Commercial beta                             | (undisclosed)                       | body-position based                                                               | body tracking, center-of-gravity, speed/direction, side-by-side attempt compare | None public                                  |
| **Plymouth paper** (Ludford, _student journal_) | Undergrad project                           | YOLOv7 pose                         | custom YOLOv7 holds                                                               | routes-climbed + attempts-per-route, auto-logging across gym cameras            | "high accuracy", few numbers                 |
| **PMC10574944** (peer-reviewed)                 | iPad+LiDAR virtual trainer                  | Apple Vision + LiDAR depth → 3D     | reference-route based                                                             | **6 named beginner errors** with graphical post-climb feedback                  | **Yes** — PR curves, best error 0.84P/0.85R  |
| **The Way Up** (arXiv 2505.12854, 2025)         | Public dataset + benchmark                  | ViTPose-L / MediaPipe / YOLOv8-pose | hold-usage = keypoint∩hold ≥0.5s                                                  | which limb on which hold, when                                                  | **Yes** — 86.6% / 83.5% / 75.3% overall      |
| **UCSD team** (Ekaireb et al., student project) | 6-student CV report-generator, single phone | MediaPipe (33 landmarks)            | YOLO/Roboflow NN — **96.3% mAP** holds, **99.3%** colour (11 classes, 2759 holds) | % complete, hold/move validity, CoM distance, move count, time                  | **Yes** — F1 0.65–0.85/clip, avg RMSPE 0.266 |
| **PMC11881084** (survey)                        | Review of 22 studies                        | —                                   | —                                                                                 | route-grading (the field's main task so far)                                    | range 31.8–98% by task                       |

**Reading of the table.** The capability ladder is real and each rung is independently demonstrated:

1. **Skeleton from a phone clip** — trivially available (MediaPipe in-browser, YOLOv8-pose, ViTPose).
2. **Derived kinematics** — CoM, joint angles, limb velocity, hip-to-wall distance — all simple math
   on keypoints (tjtl, BoulderVision, PMC10574944 all do it).
3. **Rule-based technique flags** — PMC10574944 is the proof: it encodes **6 concrete beginner
   errors** as geometric rules and reports real precision/recall. This is the single most directly
   reusable result for our feature.
4. **Hold-aware analysis** ("which hold did the hand reach, was it efficient") — needs a hold
   detector (ClimbingCoach got 97% _on its own gym_) and hold-usage logic (The Way Up dataset).
   Harder, gym-specific, the main generalisation risk.
5. **General "optimal technique" coaching** — **nobody credibly delivers this.** It requires a model
   of _what optimal is for this body on this route_ — unsolved, and where over-claiming lives.

**The six errors (PMC10574944) — concrete, copyable rule definitions:**
decoupling (arm bent during foot placement) · reaching/hand-support held >1s · weight-shift (hip not
over support leg) · both-feet-set (a foot leaves the wall mid-move) · hips >5cm off the wall vs a
reference · shoulder not relaxed after a catch. Each is a threshold on a keypoint-derived quantity —
_exactly_ the kind of pure, testable logic that fits `src/domain/**`.

## 2. The three walls everyone hits (the real engineering risk)

- **Occlusion.** Hands behind the torso, body turned to the wall → wrist/hand keypoints drop or
  jitter. The Way Up quantifies it: foothold accuracy ≫ handhold accuracy, and pose degrades as the
  climber goes _higher_ (smaller in frame, worse angle). tjtl, BoulderVision, and PMC10574944 all
  list occlusion as the dominant error source. The UCSD team names the precise failure mode worth
  guarding against: MediaPipe _infers_ (hallucinates) an occluded limb's position rather than
  dropping it → a phantom keypoint lands on a hold → **false "hold in use" detection**. Their fix —
  and the right one for us — is to gate on MediaPipe's per-landmark **`visibility`/`occluded`** value
  and discard low-visibility keypoints. **Implication:** foot/CoM/hip metrics are reliable; fine hand
  technique is not, from one camera; and any rule must check landmark visibility before firing.
- **Generalisation of hold detection.** A detector at 97% mAP _on its training gym_ is the easy case;
  BoulderVision explicitly notes "poor generalisation across wall designs" and "front-facing 90°
  only." Colour-based hold classification breaks across gyms. **Implication:** hold-aware features
  are a per-gym calibration problem, not a download-and-go model. Pose-only features avoid this.
- **Validation honesty.** Most blog/commercial sources report _zero_ accuracy numbers, or only
  _detection_ accuracy — never "was the _advice_ correct?" Only PMC10574944 and The Way Up validate
  rigorously. **Implication for us:** the gate philosophy (claims must be measured) means a CV
  feature must ship with a real eval, or it's a demo, not a coach. This is also precisely the gap a
  thesis should fill.

## 3. Feasibility _for Boulder Coach specifically_

Boulder Coach is a **Next.js PWA, offline-first, pure-domain architecture** (`src/domain` has no I/O,
no React, no `Date.now()`). A CV feature has to respect that seam. Two viable shapes:

**Option A — On-device, in-browser (recommended MVP).**

- MediaPipe Tasks (Pose Landmarker) runs in WASM/WebGPU in the browser → keypoints per frame, no
  server, no upload, **privacy-first** (matches the BC-41 framing and the app's offline ethos).
- The capture/inference glue lives in `src/app/**` (gate-blind, kept thin). The **analysis is pure**:
  a `src/domain/technique.ts` takes a typed array of per-frame keypoints + timestamps and returns
  flagged errors + CoM path. That's testable to the per-file coverage bar with recorded keypoint
  fixtures — _no video needed in CI_. This is the architecturally-clean part and the natural thesis
  "contribution" surface.
- Scope the flags to the **occlusion-robust subset**: hip-to-wall distance, weight-shift, both-feet-
  set, move tempo/rest, CoM smoothness. Defer hand-precision and hold-awareness.
- **Move segmentation (a free, reusable algorithm from the UCSD paper):** to split a climb into
  discrete "moves" for tempo/rest/flag timing, detect local maxima of limb **angular velocity** over a
  smoothed motion signal — they showed this matches ground-truth move counts far better than naive
  cosine-similarity-between-frames (which massively over-counts). This is pure math on keypoint
  series → another clean `src/domain` function.

**Option B — Server/upload pipeline (Vercel Function + heavier model).**

- ViTPose-L (86.6% in The Way Up) or a hold detector for hold-aware features. More accurate, but adds
  upload, cost, latency, and a privacy story to write. Natural fit for the **Vercel AI Gateway** if
  you want an LLM to _narrate_ the numeric findings (this is literally **BC-42**, AI-narrated review).
- Only worth it once Option A proves the analysis logic and you specifically need hold-awareness.

**Recommended path:** Option A for the analysis engine + flags; layer an optional LLM narration
(Option B / BC-42) on top of the _pure numeric findings_, never letting the LLM invent the safety- or
technique-claims. Keep the same discipline as the rest of the app: **logic in covered layers, the
component stays dumb.**

**Effort:** capture UI + MediaPipe wiring = **M**; pure technique-rule engine with tests = **M**;
hold-aware features = **L–XL** and gym-specific. An honest MVP (upload clip → skeleton overlay + 3–5
flags + CoM path, pose-only, on-device) is **M–L total** — a real but bounded feature, and a clean
new PBI sized like the existing BC-41/42/43 vision bets.

## 4. How good is it as an undergraduate thesis?

**Verdict: strong — one of the better applied-CV topics available, for four concrete reasons.**

1. **Proven at exactly this level — twice.** The Plymouth Student Scientist paper _is_ an undergraduate
   project on this exact topic (YOLOv7 pose + custom hold detector, published), and the **UCSD
   6-student project** (single phone, MediaPipe + Roboflow-trained holds at 96.3% mAP, a full
   post-climb report) is a second student-scale build with real numbers. That de-risks the "is the
   scope right for one student/one year?" question better than any argument — the answer is two
   published yeses, both single-camera.
2. **Mature, free tooling = time spent on the _question_, not plumbing.** MediaPipe / YOLOv8-pose /
   ViTPose are pretrained and documented; Roboflow handles dataset/training; a phone is the only
   sensor. A student isn't burning the year training a pose model from scratch — they're spending it
   on the _analysis and evaluation_, which is where the marks are.
3. **A real, surveyed research gap to aim at.** The 2024 survey (PMC11881084) says outright that CV is
   _under-applied_ to route-centric and movement analysis and that work over-relies on standardised
   MoonBoard walls. The Way Up (2025) created a dataset _because_ "no prior work systematically
   evaluated pose estimation for hold detection." That's an examiner-friendly "here is the gap, here
   is my slice of it" framing handed to you.
4. **Clean split between deliverable and contribution.** The _engineering deliverable_ (working app /
   pipeline) is demonstrable and motivating; the _research contribution_ (a measured claim) is
   separable and gradeable. Good theses need both; this topic gives both naturally.

**The single failure mode to avoid:** "I built an AI climbing coach that gives optimal technique."
That's unfalsifiable, unmeasurable, and over-claims — the exact thing the sources _don't_ deliver and
examiners punish. The fix is a narrow, measurable question (next section).

**Difficulty/novelty calibration:** pose-overlay + generic metrics alone is a _solid pass / good
project_ but low novelty (it's been blogged many times). To reach **distinction/novel**, add one
measured contribution on top — that's the lever, and it's cheap to add if scoped early.

## 5. Recommended thesis framings (pick ONE narrow, measurable question)

Ordered by novelty-per-effort. Each is sized for a single undergraduate and yields a number to defend.

1. **Quantify pose-estimation reliability for technique flags across camera setups.**
   Re-implement the PMC10574944 six-error rules on MediaPipe (cheap/in-browser) instead of
   iPad+LiDAR, and measure how much accuracy you lose going LiDAR→monocular and across camera
   angle/height. _Contribution:_ "can a phone replace LiDAR for beginner-error coaching, and where
   does it break?" Reuses The Way Up's occlusion findings as related work. **Highest value, lowest
   data-collection burden** (rules + fixtures, small subject pool like their n=4).
2. **Build + evaluate an explainable rule-based technique-flag system** with a small user study:
   do the flags agree with a coach's assessment? _Contribution:_ inter-rater agreement between the
   system and human coaches on real climbs. Directly fundable as a Boulder Coach feature.
3. **Hold-usage detection / efficiency scoring** on The Way Up dataset — benchmark a model and add an
   efficiency metric (path length vs optimal, dead-points). _Contribution:_ a new metric + numbers on
   a public dataset. Higher CV depth, more occlusion/generalisation risk.
4. **Cross-gym generalisation of hold detection** — train on gym A, quantify the drop on gym B, test a
   domain-adaptation trick. _Contribution:_ a generalisation study. Most data-collection-heavy.

**Thesis-shaped scope guardrails (all four sources agree):** one camera, one wall angle (front 90°),
foot/hip/CoM-dominant flags, a _named and bounded_ error set, and **report precision/recall, never
"it gives good advice."** Treat hand-precision and "optimal technique" as explicitly out of scope and
say why (occlusion, no ground truth for "optimal") — naming the limitation is itself thesis maturity.

## 6. Concrete next steps if we proceed

- **For the app:** draft a new design-only PBI (sibling to BC-41/42/43): _"CV technique flags (MVP)"_
  — Option A, on-device MediaPipe, pure `src/domain/technique.ts` with the occlusion-robust flag
  subset, keypoint-array fixtures for the gate, optional BC-42 LLM narration layered on the numeric
  findings only. Mark hand-precision/hold-awareness as future (L–XL).
- **For the thesis:** choose framing **#1** (best value/effort, lowest data burden, reuses the app
  work) and write the proposal around the PMC10574944 rules + The Way Up occlusion baseline + the
  PMC11881084-stated gap. Capture a small in-gym dataset (a handful of climbers, 2–3 reference
  routes, like the published n=4) for evaluation.
- **One coupling to exploit:** the thesis evaluation _is_ the feature's missing validation. Doing the
  thesis honestly produces exactly the accuracy numbers the app would otherwise ship without.

---

## 7. Thesis proposal outline (framing #1, ready to adapt)

> **Working title:** _Monocular phone-camera vs LiDAR depth for automated bouldering technique-error
> detection: a reproduction and reliability study._

**Research question (one, falsifiable, measurable):** When the six beginner-error rules of
PMC10574944 (built on iPad-Pro LiDAR depth) are re-implemented on a _single ordinary phone camera_
using monocular pose estimation (MediaPipe), **how much detection accuracy is lost, and which errors /
camera conditions degrade most?**

**Hypotheses:** (H1) foot/hip/CoM-based errors (both-feet-set, hip-off-wall, weight-shift) retain
usable precision/recall (≥0.7) without depth; (H2) errors needing fine hand/arm geometry (decoupling,
shoulder-relax) degrade most; (H3) accuracy falls with camera height/angle and as the climber ascends
(occlusion + apparent-size loss), reproducing The Way Up's trend.

**Method:**

1. _Stimuli:_ 2–3 reference routes, a small subject pool (the original used n=4; 6–10 is comfortably
   thesis-scale), each climb filmed simultaneously from a fixed front-90° phone + one offset angle.
2. _Ground truth:_ a coach (or two, for inter-rater) labels each error occurrence per climb → the gold
   standard the system is scored against.
3. _Pipeline:_ MediaPipe Pose Landmarker → per-frame keypoints → the six geometric rules as pure
   functions (thresholds taken from the paper, re-tuned on a held-out calibration set).
4. _Metrics:_ per-error precision/recall + IoU on event timing (same evaluation protocol as
   PMC10574944, so results are directly comparable); ablate camera angle/height.

**Contribution / novelty:** a _quantified_ answer to "can a phone replace LiDAR for beginner-error
coaching, and where does it break" — nobody has reported this comparison; it converts the field's
known occlusion intuition (The Way Up) into numbers on the _coaching_ task, not just detection.

**Scope guardrails (state explicitly — naming limits is maturity):** one wall angle, beginner-error
subset only, no hold-awareness, no "optimal technique" claim (no ground truth exists for it).

**Why it's right-sized:** pretrained pose model (no training), rules are arithmetic on keypoints, the
only fieldwork is a half-day of filming + a coach's labels. The Plymouth precedent shows this band of
effort publishes at undergraduate level.

**Suggested chapter skeleton:** Intro & motivation (Olympic visibility, accessibility, coaching gap) →
Related work (PMC11881084 survey, PMC10574944, The Way Up, BoulderVision/ClimbingCoach as applied
precedent) → Method (capture rig, pose, the six rules, ground-truth protocol) → Results (per-error
P/R, angle/height ablation) → Discussion (which errors survive monocular, occlusion failure modes) →
Limitations & future work (hold-awareness, multi-camera, larger cohort) → Conclusion.

**Reusable with the app:** the rule functions written for the thesis _are_ the app's
`src/domain/technique.ts`; the thesis's measured P/R _is_ the validation the feature would otherwise
ship without. One body of work, two deliverables.

---

## 8. Python implementation blueprint (for the thesis — framing #1)

Concrete enough to start. This is the **thesis** pipeline (Python — the right choice there, per §3 and
the spec's pose-runtime decision); the app would later port only the pure rule functions to TS, since
the keypoint array is the shared seam.

### Stack

| Concern             | Library / tool                                         | Note                                                                         |
| ------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| Pose (baseline)     | **MediaPipe** (`mediapipe`)                            | The thing you're testing against LiDAR — must match PMC10574944's landmarks. |
| Pose (accuracy arm) | **ViTPose** via `mmpose`, or `ultralytics` YOLOv8-pose | For the "does a heavier model recover the loss?" ablation.                   |
| Video I/O           | `opencv-python`                                        | Frame extraction, overlay rendering for the thesis figures.                  |
| Numerics            | `numpy`, `scipy` (`savgol_filter`)                     | Angular-velocity smoothing for move segmentation (UCSD's method).            |
| Eval / stats        | `scikit-learn` (precision/recall, PR curves), `pandas` | The result tables — comparable to PMC10574944.                               |
| Labels              | a tiny JSON/CSV schema (see below)                     | Coach ground truth; no heavyweight annotation tool needed.                   |

### Repo layout (separate from the app — it is the thesis, not app code)

```
climb-technique-thesis/
  data/
    raw/<climber>/<route>/<angle>.mp4        # filmed clips
    labels/<clip>.json                        # coach ground truth (errors + frame ranges)
    keypoints/<clip>.<model>.json             # cached pose output (KeypointFrame[] — the seam)
  src/
    pose/extract.py        # video → KeypointFrame[]; one fn per model (mediapipe|vitpose|yolo)
    rules/                 # the SIX-error rules — pure fns on keypoints (port target for the app)
      geometry.py          #   hip-to-wall, weight-shift, foot-cut, tempo, over-reach, (+arm errors)
      segment.py           #   angular-velocity peak move segmentation
      visibility.py        #   gate: drop landmarks below VISIBILITY_MIN (the UCSD false-positive fix)
    eval/
      score.py             # flags vs labels → per-error precision/recall + IoU on timing
      ablate.py            # sweep model × camera-angle × wall-height → the result tables/figures
  notebooks/figures.ipynb  # PR curves, occlusion-vs-height plots for the write-up
```

### Ground-truth label schema (keep it trivial)

```json
{
  "clip": "alice_route5a_front",
  "fps": 60,
  "errors": [
    { "kind": "foot-cut", "startFrame": 212, "endFrame": 240 },
    { "kind": "hip-off-wall", "startFrame": 388, "endFrame": 455 }
  ]
}
```

A coach scrubs each clip once and fills this — that's the whole annotation cost. Scoring = does a rule
fire within the labelled frame range (IoU on the interval), per error kind.

### The experiment loop (this produces the thesis result)

1. `extract.py` → cache `KeypointFrame[]` for each clip under **each** pose model (so pose runs once).
2. `rules/` → run the six-error detectors on each cached keypoint set, visibility-gated.
3. `eval/score.py` → per-error precision/recall vs the coach labels.
4. `eval/ablate.py` → group results by **model × camera angle × wall-height-bin** → the tables that
   answer H1/H2/H3 (§7): which errors survive monocular, which models recover accuracy, where height
   degrades it.

### The reuse contract with the app

The `rules/` functions are **arithmetic on keypoints** — no Python-specific magic. When BC-24 is
scheduled, port them to `src/domain/technique.ts` (or, if a Python service path is chosen per the spec,
call them server-side). Either way the **thesis's measured precision/recall becomes the app feature's
validation** — the single coupling that makes one body of work serve both. Keep the keypoint JSON
schema identical on both sides so a fixture recorded for the thesis is a test fixture for the app.

---

## References

1. tjtl.io — _Bouldering and Computer Vision_ — https://blog.tjtl.io/bouldering-and-computer-vision/
2. ZeTioZ — _ClimbingCoach_ (GitHub) — https://github.com/ZeTioZ/ClimbingCoach
3. Belay.ai — https://belay.ai/
4. Ludford, G. — _Development of a climbing performance analysis tool using computer vision_, **The
   Plymouth Student Scientist** (undergraduate journal), 2024 —
   https://pearl.plymouth.ac.uk/tpss/vol17/iss2/17/ ·
   https://www.researchgate.net/publication/387283911
5. Roboflow — _Using Computer Vision to Assess Bouldering Performance (BoulderVision)_ —
   https://blog.roboflow.com/bouldering/
6. J. Park — LinkedIn AI/CV climbing post (not retrievable; referenced for context) —
   https://www.linkedin.com/posts/jeremyipark_ai-machinelearning-computervision-activity-7453521895401938944-78-S/
7. Ekaireb, Khan, Pathuri, Bhatia, Sharma, Manjunath-Murkal (UCSD) — _Computer Vision Based Indoor
   Rock Climbing Analysis_ (6-student project; single phone, MediaPipe + Roboflow-trained YOLO holds
   96.3% mAP / 99.3% colour, angular-velocity move segmentation, avg RMSPE 0.266; occlusion →
   hallucinated-limb false positives named as the key failure) —
   https://kastner.ucsd.edu/ryan/.../rock-climbing-coach.pdf
8. _Climbing Technique Evaluation by Means of Skeleton Video Stream Analysis_ (iPad+LiDAR, 6 beginner
   errors, validated) — PMC10574944 — https://pmc.ncbi.nlm.nih.gov/articles/PMC10574944/
9. _Survey of ML/DL for objective route-grading & the CV gap_ — PMC11881084 —
   https://pmc.ncbi.nlm.nih.gov/articles/PMC11881084/
10. _The Way Up: A Dataset for Hold Usage Detection in Sport Climbing_, arXiv 2505.12854, 2025 —
    https://arxiv.org/html/2505.12854v1
