import { describe, it, expect } from 'vitest';
import { run } from '../../scripts/crew/crew.mjs';

describe('crew CLI dispatch', () => {
  it('returns false and prints usage for an unknown command', () => {
    expect(run(['definitely-not-a-real-command'])).toBe(false);
  });
});
