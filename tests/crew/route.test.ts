import { describe, it, expect } from 'vitest';
import { decideAction } from '../../scripts/crew/lib/route.mjs';

describe('decideAction (mock)', () => {
  it('merges when tier is auto and the reviewer approves', () => {
    expect(decideAction('auto', { verdict: 'approve' })).toEqual({ action: 'merge' });
  });
  it('queues when tier is review regardless of verdict', () => {
    expect(decideAction('review', { verdict: 'approve' })).toEqual({
      action: 'queue',
      reason: 'tier=review',
    });
  });
  it('queues when the reviewer flags an auto-tier branch', () => {
    expect(decideAction('auto', { verdict: 'flag', reason: 'mock silent failure' })).toEqual({
      action: 'queue',
      reason: 'mock silent failure',
    });
  });
  it('queues (fail-safe) when no reviewer verdict is available', () => {
    expect(decideAction('auto', null)).toEqual({
      action: 'queue',
      reason: 'no reviewer verdict',
    });
  });
});
