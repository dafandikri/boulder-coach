import { describe, it, expect } from 'vitest';
import { generateProgram } from '../../src/domain/periodization';
import { pickDaySession } from '../../src/domain/schedule';
import { hasRichContent } from '../../src/domain/exerciseContent';
import type { UserProfile } from '../../src/domain/types';

const profile: UserProfile = {
  currentGrade: 5, // mock V5 climber
  goalGrade: 7,
  sessionsPerWeek: 3,
  availableWeekdays: [1, 3, 5], // Mon / Wed / Fri
};

// Week 0 rotation for 3/week: limit-boulder, power-endurance, volume-technique.
const week = generateProgram(profile, '2026-06-01').weeks[0]!;

describe('pickDaySession', () => {
  it('prescribes training only on availableWeekdays and rest on every other day', () => {
    const byWeekday: Record<number, string> = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(2026, 5, 1 + i); // a full local week, Mon..Sun
      byWeekday[d.getDay()] = pickDaySession(week, profile.availableWeekdays, d).type;
    }
    for (let day = 0; day < 7; day++) {
      if (profile.availableWeekdays.includes(day)) {
        expect(byWeekday[day]).not.toBe('rest');
      } else {
        expect(byWeekday[day]).toBe('rest');
      }
    }
  });

  it('maps weekdays to the session rotation in ascending order', () => {
    const monday = new Date(2026, 5, 1); // first available day → first session
    expect(monday.getDay()).toBe(1);
    expect(pickDaySession(week, [1, 3, 5], monday).type).toBe(week.sessions[0]!.type);

    const friday = new Date(2026, 5, 5); // third available day → third session
    expect(friday.getDay()).toBe(5);
    expect(pickDaySession(week, [1, 3, 5], friday).type).toBe(week.sessions[2]!.type);
  });

  it('returns an explicit recovery prescription on rest days (not a blank)', () => {
    const tuesday = new Date(2026, 5, 2); // not in [1,3,5]
    const rest = pickDaySession(week, [1, 3, 5], tuesday);
    expect(rest.type).toBe('rest');
    expect(rest.blocks.length).toBeGreaterThan(0); // a real recovery card
    expect(rest.blocks.some((b) => b.category === 'main')).toBe(false); // no climbing load
  });

  it('rests on a training weekday that has no planned session (more weekdays than sessions)', () => {
    // 3 session types, but 4 declared training days → the 4th day is rest, not a
    // fabricated repeat. asOf = Thursday (the 4th day in [1,2,3,4]).
    const thursday = new Date(2026, 5, 4);
    expect(thursday.getDay()).toBe(4);
    expect(pickDaySession(week, [1, 2, 3, 4], thursday).type).toBe('rest');
  });

  it('gives the rest-day recovery block rich how-to content (BC-52)', () => {
    const tuesday = new Date(2026, 5, 2); // a rest day
    const rest = pickDaySession(week, [1, 3, 5], tuesday);
    for (const b of rest.blocks) {
      expect(b.content, `rest block ${b.id} missing content`).toBeDefined();
      expect(hasRichContent(b.content!), `rest block ${b.id} not rich`).toBe(true);
    }
  });

  it('rests when the week has no sessions at all (malformed/empty week)', () => {
    const emptyWeek = { weekIndex: 0, phase: 'hard' as const, sessions: [] };
    const monday = new Date(2026, 5, 1);
    expect(pickDaySession(emptyWeek, [1, 3, 5], monday).type).toBe('rest');
  });
});
