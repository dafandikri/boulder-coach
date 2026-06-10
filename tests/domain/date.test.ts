// Pin the runner to a UTC+7 zone so the local-vs-UTC distinction is observable.
// (Node re-reads process.env.TZ for Date math, so setting it before any Date works.)
process.env.TZ = 'Asia/Jakarta';

import { describe, it, expect } from 'vitest';
import { localDateIso } from '../../src/app/lib/date';

describe('localDateIso', () => {
  it('returns the LOCAL calendar date, not the UTC date', () => {
    // 19:00 UTC on 2026-06-09 is 02:00 on 2026-06-10 in Jakarta (UTC+7).
    const earlyMorningWib = new Date('2026-06-09T19:00:00Z');
    expect(localDateIso(earlyMorningWib)).toBe('2026-06-10');
    // Sanity: the old UTC-slice approach would have filed it under the previous day.
    expect(earlyMorningWib.toISOString().slice(0, 10)).toBe('2026-06-09');
  });

  it('zero-pads month and day', () => {
    const d = new Date('2026-01-05T05:00:00Z'); // 12:00 WIB, 2026-01-05
    expect(localDateIso(d)).toBe('2026-01-05');
  });
});
