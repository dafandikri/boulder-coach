import { describe, it, expect } from 'vitest';
import {
  imagePathFor,
  hasRichContent,
  PLACEHOLDER_IMAGE,
  type ExerciseContent,
} from '../../src/domain/exerciseContent';

// BC-46 — the shared content model behind every exercise surface (session blocks,
// drills, prehab). Pure: path resolution + a "is there detail to show" check. The
// component (ExerciseDetail) renders; the logic lives here (covered).

describe('imagePathFor', () => {
  it('resolves a real imageId to the public/exercises convention', () => {
    expect(imagePathFor('silent-feet')).toBe('/exercises/silent-feet.svg');
  });

  it('falls back to the placeholder for a missing or blank id (never a broken <img>)', () => {
    expect(imagePathFor(undefined)).toBe(PLACEHOLDER_IMAGE);
    expect(imagePathFor('')).toBe(PLACEHOLDER_IMAGE);
    expect(imagePathFor('   ')).toBe(PLACEHOLDER_IMAGE);
  });
});

describe('hasRichContent', () => {
  it('is true when any of steps / cues / mistakes / dosage is present', () => {
    const c: ExerciseContent = { steps: ['Place foot'], cues: [], commonMistakes: [] };
    expect(hasRichContent(c)).toBe(true);
    expect(hasRichContent({ steps: [], cues: ['Quiet'], commonMistakes: [] })).toBe(true);
    expect(hasRichContent({ steps: [], cues: [], commonMistakes: [], dosage: '3×12' })).toBe(true);
  });

  it('is false for a fully empty content block', () => {
    expect(hasRichContent({ steps: [], cues: [], commonMistakes: [] })).toBe(false);
  });
});
