import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readClaims, writeClaim, releaseClaim, tryClaim } from '../../scripts/crew/lib/claims.mjs';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'crew-test-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const mockClaim = (pbiId: string, owner: string) => ({
  pbiId,
  files: [`mock/${pbiId}.ts`],
  worktree: 'mock-wt',
  branch: 'mock-branch',
  status: 'claimed',
  heartbeat: '2026-06-10T10:00:00.000Z',
  owner,
});

describe('claims store (tmp dir)', () => {
  it('writes and reads back a claim', () => {
    writeClaim(dir, mockClaim('BC-99', 'mock-w1'));
    const claims = readClaims(dir);
    expect(claims).toHaveLength(1);
    expect(claims[0]?.pbiId).toBe('BC-99');
  });
  it('tryClaim succeeds when unclaimed, fails when already claimed', () => {
    expect(tryClaim(dir, mockClaim('BC-1', 'mock-w1'))).toBe(true);
    expect(tryClaim(dir, mockClaim('BC-1', 'mock-w2'))).toBe(false);
  });
  it('releaseClaim removes the claim file', () => {
    tryClaim(dir, mockClaim('BC-2', 'mock-w1'));
    releaseClaim(dir, 'BC-2');
    expect(readClaims(dir)).toHaveLength(0);
  });
});
