import { describe, it, expect } from 'vitest';
import {
  restConfigFor,
  restEndsAt,
  restRemainingSec,
  restElapsed,
  formatRest,
  type SessionType,
} from '../../../src/app/lib/restTimer';

// A fixed mock "now" so the wall-clock maths is deterministic (test marker: MOCK_NOW).
const MOCK_NOW = 1_700_000_000_000;

describe('restConfigFor', () => {
  it('gives limit bouldering a full ~3 min rest between efforts and no rounds', () => {
    const cfg = restConfigFor('limit-boulder');
    expect(cfg.betweenSets).toBe(180);
    expect(cfg.betweenRounds).toBeUndefined();
  });

  it('gives power-endurance (4×4) ~1 min between problems and ~4 min between rounds', () => {
    const cfg = restConfigFor('power-endurance');
    expect(cfg.betweenSets).toBe(60);
    expect(cfg.betweenRounds).toBe(240);
  });

  it('gives every session type a non-negative betweenSets default', () => {
    const types: SessionType[] = [
      'limit-boulder',
      'power-endurance',
      'volume-technique',
      'antagonist-prehab',
      'rest',
    ];
    for (const t of types) {
      expect(restConfigFor(t).betweenSets).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('restEndsAt', () => {
  it('is now + duration in ms', () => {
    expect(restEndsAt(MOCK_NOW, 180)).toBe(MOCK_NOW + 180_000);
  });

  it('clamps a negative duration to now (no rest in the past)', () => {
    expect(restEndsAt(MOCK_NOW, -10)).toBe(MOCK_NOW);
  });
});

describe('restRemainingSec', () => {
  it('rounds up partial seconds so the display never shows 0 while time remains', () => {
    const endsAt = MOCK_NOW + 1500; // 1.5s left
    expect(restRemainingSec(endsAt, MOCK_NOW)).toBe(2);
  });

  it('is the exact whole seconds when evenly divisible', () => {
    expect(restRemainingSec(MOCK_NOW + 180_000, MOCK_NOW)).toBe(180);
  });

  it('never goes negative once the clock passes the end (survives a long screen-lock)', () => {
    expect(restRemainingSec(MOCK_NOW, MOCK_NOW + 999_999)).toBe(0);
  });
});

describe('restElapsed', () => {
  it('is false while time remains', () => {
    expect(restElapsed(MOCK_NOW + 1000, MOCK_NOW)).toBe(false);
  });

  it('is true exactly at and after the end timestamp', () => {
    expect(restElapsed(MOCK_NOW, MOCK_NOW)).toBe(true);
    expect(restElapsed(MOCK_NOW, MOCK_NOW + 5000)).toBe(true);
  });
});

describe('formatRest', () => {
  it('renders M:SS with a zero-padded seconds field', () => {
    expect(formatRest(180)).toBe('3:00');
    expect(formatRest(65)).toBe('1:05');
    expect(formatRest(9)).toBe('0:09');
  });

  it('floors fractional input and clamps negatives to 0:00', () => {
    expect(formatRest(59.9)).toBe('0:59');
    expect(formatRest(-3)).toBe('0:00');
  });
});
