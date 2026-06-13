# Exercise illustrations (`public/exercises/`)

BC-46 image convention. Each exercise's `imageId` resolves to `public/exercises/<imageId>.svg`
via `imagePathFor` (`src/domain/exerciseContent.ts`). When an exercise has no `imageId`, or the
asset is missing, the UI shows `_placeholder.svg` — never a broken `<img>`.

## Conventions

- **Format:** SVG (sharp at any size, tiny, brand-tintable, no layout shift, offline-friendly).
- **Viewbox:** `0 0 320 200` (the detail card caps height at 200px, `object-fit: contain`).
- **Filename = `imageId`.** e.g. `imageId: 'silent-feet'` → `silent-feet.svg`.
- **Accessibility:** include `role="img"` + a descriptive `aria-label`; the component also sets `alt`.
- **Palette:** lean on the brand hold colors so illustrations match the design system.

## Present assets

- `_placeholder.svg` — generic fallback (required; do not delete).
- `silent-feet.svg` — footwork drill (BC-49 example).
- `band-pull-apart.svg` — shoulder prehab (BC-50 example).
- `limit-boulder.svg`, `power-endurance-4x4.svg`, `volume-technique.svg`,
  `antagonist-prehab.svg` — main session-block illustrations (BC-47).
- `warmup-raise.svg`, `warmup-mobilize.svg`, `warmup-potentiate.svg` — warm-up blocks (BC-52).
- `cooldown-prehab.svg`, `active-recovery.svg` — cooldown / rest-day blocks (BC-52).

Add more as later PBIs fill in real content; keep one SVG per `imageId`.
