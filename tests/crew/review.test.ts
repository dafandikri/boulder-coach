import { describe, it, expect } from 'vitest';
import { runReviewer } from '../../scripts/crew/lib/review.mjs';

// The reviewer must be FAIL-SAFE (a broken agent → FLAG → human, never a throw
// that strands the claim) and TOOL-NEUTRAL (uses the injected agent argv, so it
// doesn't hard-require `claude`). Using a non-existent binary exercises both.
describe('runReviewer (fail-safe + tool-neutral)', () => {
  it('returns FLAG (not a throw) when the configured agent binary is missing', () => {
    const v = runReviewer('agent/BC-90', 'BC-90', ['definitely-not-a-real-binary-xyz123']);
    expect(v.verdict).toBe('flag');
    expect(v.reason).toMatch(/reviewer unavailable/);
  });

  it('returns FLAG when no agent command is configured', () => {
    expect(runReviewer('agent/BC-90', 'BC-90', []).verdict).toBe('flag');
  });
});
