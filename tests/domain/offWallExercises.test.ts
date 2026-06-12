import { describe, it, expect } from 'vitest';
import {
  OFF_WALL_EXERCISES,
  getExercisesByPurpose,
  prescribeOffWall,
  type ExercisePurpose,
} from '../../src/domain/offWallExercises';
import type { SessionType, PhaseKind } from '../../src/domain/types';
import { hasRichContent } from '../../src/domain/exerciseContent';

const ALL_SESSION_TYPES: SessionType[] = [
  'limit-boulder',
  'power-endurance',
  'volume-technique',
  'antagonist-prehab',
  'rest',
];

const PURPOSES: ExercisePurpose[] = ['antagonist', 'core', 'mobility'];

describe('off-wall exercise library', () => {
  it('has seeded exercises', () => {
    expect(OFF_WALL_EXERCISES.length).toBeGreaterThan(0);
  });

  it('covers every purpose with at least one exercise', () => {
    for (const purpose of PURPOSES) {
      expect(getExercisesByPurpose(purpose).length).toBeGreaterThan(0);
    }
  });

  it('each exercise has required fields and a valid purpose', () => {
    for (const ex of OFF_WALL_EXERCISES) {
      expect(ex.id).toBeTruthy();
      expect(ex.name).toBeTruthy();
      expect(ex.purpose).toMatch(/^(antagonist|core|mobility)$/);
      expect(ex.description).toBeTruthy();
    }
  });

  it('exercise ids are unique', () => {
    const ids = OFF_WALL_EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every exercise carries dosage + rich detail content (BC-50)', () => {
    for (const ex of OFF_WALL_EXERCISES) {
      expect(ex.dosage).toBeTruthy(); // sets × reps prescription
      expect(ex.steps.length).toBeGreaterThan(0);
      expect(Array.isArray(ex.commonMistakes)).toBe(true);
      expect(ex.imageId).toBeTruthy();
      expect(hasRichContent(ex)).toBe(true);
    }
  });

  it('filters by purpose', () => {
    const core = getExercisesByPurpose('core');
    expect(core.length).toBeGreaterThan(0);
    expect(core.every((e) => e.purpose === 'core')).toBe(true);
  });
});

describe('prescribeOffWall — SessionType → purposes mapping', () => {
  it('antagonist + core after a limit/strength day (balance pull-heavy load)', () => {
    const rx = prescribeOffWall('limit-boulder');
    expect(rx.purposes).toEqual(['antagonist', 'core']);
    expect(rx.exercises.length).toBeGreaterThan(0);
    expect(rx.exercises.every((e) => rx.purposes.includes(e.purpose))).toBe(true);
  });

  it('antagonist + core after power-endurance', () => {
    expect(prescribeOffWall('power-endurance').purposes).toEqual(['antagonist', 'core']);
  });

  it('core + mobility on a lighter volume/technique day', () => {
    expect(prescribeOffWall('volume-technique').purposes).toEqual(['core', 'mobility']);
  });

  it('antagonist + mobility on an antagonist-prehab day', () => {
    expect(prescribeOffWall('antagonist-prehab').purposes).toEqual(['antagonist', 'mobility']);
  });

  it('mobility only on a rest day (recovery)', () => {
    expect(prescribeOffWall('rest').purposes).toEqual(['mobility']);
  });

  it('deload phase forces mobility-only regardless of session type (recovery emphasis)', () => {
    const deload: PhaseKind = 'deload';
    for (const type of ALL_SESSION_TYPES) {
      expect(prescribeOffWall(type, deload).purposes).toEqual(['mobility']);
    }
  });

  it('non-deload phases do not override the session-type mapping', () => {
    expect(prescribeOffWall('limit-boulder', 'hard').purposes).toEqual(['antagonist', 'core']);
    expect(prescribeOffWall('limit-boulder', 'peak').purposes).toEqual(['antagonist', 'core']);
  });

  it('is deterministic — same input yields the same prescription', () => {
    const a = prescribeOffWall('limit-boulder');
    const b = prescribeOffWall('limit-boulder');
    expect(a).toEqual(b);
  });

  it('returns a short set (additive supplement, not a workload)', () => {
    for (const type of ALL_SESSION_TYPES) {
      const rx = prescribeOffWall(type);
      expect(rx.exercises.length).toBeGreaterThan(0);
      expect(rx.exercises.length).toBeLessThanOrEqual(4);
    }
  });

  it('only returns exercises whose purpose is in the prescribed purposes', () => {
    for (const type of ALL_SESSION_TYPES) {
      const rx = prescribeOffWall(type);
      expect(rx.exercises.every((e) => rx.purposes.includes(e.purpose))).toBe(true);
    }
  });
});
