import { describe, it, expect } from 'vitest';
import {
  acwrBand,
  explainAcwr,
  explainRpe,
  RPE_SCALE,
  explainAttemptsSends,
} from '../../src/app/lib/explainers';

describe('acwrBand — mirrors the adaptation engine thresholds', () => {
  it('returns no-data only at exactly 0', () => {
    expect(acwrBand(0)).toBe('no-data');
  });

  it('flags detraining below the 0.8 floor', () => {
    expect(acwrBand(0.5)).toBe('detraining');
    expect(acwrBand(0.79)).toBe('detraining');
  });

  it('is the sweet spot across 0.8–1.29', () => {
    expect(acwrBand(0.8)).toBe('sweet');
    expect(acwrBand(1.0)).toBe('sweet');
    expect(acwrBand(1.29)).toBe('sweet');
  });

  it('is caution from 1.3 up to and including 1.5 (rule 4: >= 1.3)', () => {
    expect(acwrBand(1.3)).toBe('caution');
    expect(acwrBand(1.5)).toBe('caution');
  });

  it('is high only above 1.5 (rule 3: > 1.5)', () => {
    expect(acwrBand(1.51)).toBe('high');
    expect(acwrBand(2.5)).toBe('high');
  });
});

describe('explainAcwr', () => {
  it('returns the band, a heading, and a body that explains the ratio', () => {
    const e = explainAcwr(1.6);
    expect(e.band).toBe('high');
    expect(e.heading.length).toBeGreaterThan(0);
    expect(e.body.toLowerCase()).toContain('load');
    // the personalised read names the climber's actual ratio
    expect(e.body).toContain('1.6');
  });

  it('does not invent a number when there is no data', () => {
    const e = explainAcwr(0);
    expect(e.band).toBe('no-data');
    expect(e.body).not.toContain('0.0');
    expect(e.body.length).toBeGreaterThan(0);
  });

  it('gives a distinct read per band', () => {
    const bodies = new Set([0, 0.6, 1.0, 1.4, 1.7].map((v) => explainAcwr(v).body));
    expect(bodies.size).toBe(5);
  });
});

describe('explainRpe', () => {
  it('explains RPE in plain language', () => {
    const e = explainRpe();
    expect(e.heading.toLowerCase()).toContain('rpe');
    expect(e.body.length).toBeGreaterThan(0);
  });

  it('RPE_SCALE spans 1..10 in ascending order with labels', () => {
    expect(RPE_SCALE[0]?.value).toBe(1);
    expect(RPE_SCALE[RPE_SCALE.length - 1]?.value).toBe(10);
    for (let i = 1; i < RPE_SCALE.length; i++) {
      expect(RPE_SCALE[i]!.value).toBeGreaterThan(RPE_SCALE[i - 1]!.value);
      expect(RPE_SCALE[i]!.label.length).toBeGreaterThan(0);
    }
  });
});

describe('explainAttemptsSends (BC-65)', () => {
  it('defines attempt and send in plain language', () => {
    const e = explainAttemptsSends();
    expect(e.heading.toLowerCase()).toContain('attempt');
    expect(e.body.toLowerCase()).toContain('attempt');
    expect(e.body.toLowerCase()).toContain('send');
    expect(e.body.toLowerCase()).toContain('flash');
  });
});
