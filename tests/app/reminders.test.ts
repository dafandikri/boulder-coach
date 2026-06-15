import { describe, it, expect } from 'vitest';
import {
  shouldRemindOnOpen,
  reminderContent,
  MORNING_END_HOUR,
  type RemindInput,
} from '../../src/app/lib/reminders';
import type { SessionType } from '../../src/domain/types';

// BC-20 — training-day reminders. A PWA with no push backend can't fire a true
// scheduled notification, so the honest MVP is a best-effort nudge when the user
// OPENS the app on a training-day morning (not yet reminded today). The decision is
// pure + injectable so the page stays I/O-only; the Notification glue is gate-blind.

function input(overrides: Partial<RemindInput> = {}): RemindInput {
  return {
    enabled: true,
    permission: 'granted',
    isTrainingDay: true,
    hour: 8,
    lastRemindedIso: null,
    todayIso: '2026-06-15',
    ...overrides,
  };
}

describe('shouldRemindOnOpen (BC-20)', () => {
  it('fires on a training-day morning when enabled, permitted, and not yet reminded today', () => {
    expect(shouldRemindOnOpen(input())).toBe(true);
  });

  it('does not fire when reminders are disabled', () => {
    expect(shouldRemindOnOpen(input({ enabled: false }))).toBe(false);
  });

  it('does not fire without granted notification permission', () => {
    expect(shouldRemindOnOpen(input({ permission: 'denied' }))).toBe(false);
    expect(shouldRemindOnOpen(input({ permission: 'default' }))).toBe(false);
  });

  it('does not fire on a rest day (only training days get the nudge)', () => {
    expect(shouldRemindOnOpen(input({ isTrainingDay: false }))).toBe(false);
  });

  it('does not fire outside the morning window', () => {
    expect(shouldRemindOnOpen(input({ hour: MORNING_END_HOUR }))).toBe(false);
    expect(shouldRemindOnOpen(input({ hour: 20 }))).toBe(false);
  });

  it('does not fire twice on the same day (already reminded)', () => {
    expect(shouldRemindOnOpen(input({ lastRemindedIso: '2026-06-15' }))).toBe(false);
  });

  it('fires again on a new day after a prior reminder', () => {
    expect(shouldRemindOnOpen(input({ lastRemindedIso: '2026-06-14' }))).toBe(true);
  });
});

describe('reminderContent (BC-20)', () => {
  const types: SessionType[] = [
    'limit-boulder',
    'power-endurance',
    'volume-technique',
    'antagonist-prehab',
    'rest',
  ];

  it('returns a non-empty title and body for every session type (never blank)', () => {
    for (const type of types) {
      const c = reminderContent(type);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThan(0);
    }
  });

  it('nudges the climber to check in first on a limit day (mirrors the PO example)', () => {
    expect(reminderContent('limit-boulder').body).toMatch(/limit/i);
    expect(reminderContent('limit-boulder').body).toMatch(/check in/i);
  });
});
