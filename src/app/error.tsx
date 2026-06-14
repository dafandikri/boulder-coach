'use client'; // Error boundaries must be Client Components.

import { useEffect } from 'react';
import Link from 'next/link';
import { Callout } from '@/app/components/Callout';
import { Button } from '@/app/components/Button';
import {
  RECOVERY_COPY,
  RECOVERY_ACTIONS,
  safeErrorDigest,
  type RecoveryAction,
} from '@/app/lib/errorRecovery';

/**
 * BC-33 — segment-level crash recovery. A render error inside the app shows this
 * branded fallback (reload + export) instead of a blank screen, and never exposes a
 * raw stack. Copy/actions live in the covered `errorRecovery` lib; this only renders.
 * Next 16 passes `unstable_retry` (the recommended retry that re-fetches + re-renders;
 * `reset` is also passed but only clears state without re-fetching).
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // Console only — a stack-free digest, never surfaced to the user.
    console.error('[boulder-coach] recovered from render error:', safeErrorDigest(error));
  }, [error]);

  const reload = RECOVERY_ACTIONS.find((a) => a.kind === 'reload');
  const exportAction = RECOVERY_ACTIONS.find(
    (a): a is Extract<RecoveryAction, { kind: 'link' }> => a.kind === 'link',
  );

  return (
    <main className="space-y-4 p-5">
      <Callout tone="danger" title={RECOVERY_COPY.title} icon="triangle-alert">
        <p style={{ marginBottom: 12 }}>{RECOVERY_COPY.message}</p>
        <div className="flex gap-2.5">
          {reload && (
            <Button
              icon="activity"
              onClick={() => {
                unstable_retry();
              }}
            >
              {reload.label}
            </Button>
          )}
          {exportAction && (
            <Link href={exportAction.href} className="bc-btn bc-btn--secondary">
              {exportAction.label}
            </Link>
          )}
        </div>
      </Callout>
    </main>
  );
}
