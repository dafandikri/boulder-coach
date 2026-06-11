import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

// The worker launch adapter is gate-blind in the strongest sense: it is a shell
// script no other test exercises, and a real bug in it only surfaces on a live
// `pnpm crew start`. This caused the worker prompt to be silently dropped — the
// variadic `--disallowed-tools <tools...>` flag greedily consumed the trailing
// positional charge, so each word of the prompt became a bogus deny rule and the
// worker received an EMPTY charge. These static assertions promote that bug to a
// Tier-1 gate check: the adapter's security + prompt-delivery contract now fails
// the gate on regression, no live run required.
const adapter = readFileSync(join(process.cwd(), 'scripts/crew/adapters/claude.sh'), 'utf8');

describe('claude worker adapter — prompt delivery', () => {
  it('feeds the charge on stdin, never as a positional after --disallowed-tools', () => {
    // The charge MUST arrive via stdin (here-string / pipe) so the variadic
    // --disallowed-tools flag cannot swallow it.
    expect(adapter).toMatch(/<<<\s*"\$charge"/);
    // Regression guard: the old broken form passed the charge as a bare trailing
    // positional (a line that is just `"$charge"`). That must never come back.
    const barePositional = /\n\s*"\$charge"\s*(\n|$)/.test(adapter);
    expect(barePositional).toBe(false);
  });
});

describe('claude worker adapter — security contract', () => {
  it('hard-blocks push and PR tools for the autonomous worker', () => {
    expect(adapter).toContain('--disallowed-tools');
    expect(adapter).toContain('Bash(git push:*)');
    expect(adapter).toContain('gh pr create');
    expect(adapter).toContain('gh pr merge');
  });

  it('uses acceptEdits + an allowlist, never a blanket bypass', () => {
    expect(adapter).toContain('--permission-mode acceptEdits');
    // Assert against actual flag USAGE, not the word: the adapter's comment
    // legitimately names bypassPermissions to explain why it is avoided.
    expect(adapter).not.toMatch(/--permission-mode\s+bypassPermissions/);
    expect(adapter).not.toMatch(/--allow-dangerously-skip-permissions/);
    expect(adapter).not.toMatch(/--dangerously-skip-permissions/);
  });
});
