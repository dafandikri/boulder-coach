// BC-46 — the shared content model behind every exercise surface (session blocks,
// drills, prehab/off-wall). One shape + one resolver so BC-47/49/50 render the same
// detailed card instead of re-implementing it three ways. Pure: no I/O, no React.

export interface ExerciseContent {
  /** Ordered how-to steps the climber follows. */
  steps: string[];
  /** Short form cues (the things to feel/watch). */
  cues: string[];
  /** Frequent errors to avoid. */
  commonMistakes: string[];
  /** Optional sets × reps × rest prescription, e.g. "3 × 12, slow eccentric". */
  dosage?: string;
  /** Optional image key resolving to `public/exercises/<id>.svg`. */
  imageId?: string;
}

/** Shown when an exercise has no `imageId` (or the asset is absent) — never a broken <img>. */
export const PLACEHOLDER_IMAGE = '/exercises/_placeholder.svg';

/** Resolve an image key to its public path, or the placeholder when there's no id. */
export function imagePathFor(imageId: string | undefined): string {
  const id = imageId?.trim();
  return id ? `/exercises/${id}.svg` : PLACEHOLDER_IMAGE;
}

/** True when there is any detail worth expanding into a detail view. */
export function hasRichContent(content: ExerciseContent): boolean {
  return (
    content.steps.length > 0 ||
    content.cues.length > 0 ||
    content.commonMistakes.length > 0 ||
    (content.dosage ?? '').trim().length > 0
  );
}
