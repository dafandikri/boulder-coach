'use client'; // Error boundaries must be Client Components.

import { useEffect } from 'react';
import {
  RECOVERY_COPY,
  RECOVERY_ACTIONS,
  safeErrorDigest,
  type RecoveryAction,
} from '@/app/lib/errorRecovery';

/**
 * BC-33 — root-level crash recovery. `global-error` replaces the root layout when an
 * error escapes it, so it must supply its own <html>/<body> and cannot rely on the
 * app shell or its CSS — hence the self-contained inline styles. Copy/actions come
 * from the covered `errorRecovery` lib; no raw stack is ever shown.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error('[boulder-coach] root crash recovered:', safeErrorDigest(error));
  }, [error]);

  const reload = RECOVERY_ACTIONS.find((a) => a.kind === 'reload');
  const exportAction = RECOVERY_ACTIONS.find(
    (a): a is Extract<RecoveryAction, { kind: 'link' }> => a.kind === 'link',
  );

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          background: '#faf7f2',
          color: '#1c1917',
          padding: 24,
        }}
      >
        <main style={{ maxWidth: 380, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>{RECOVERY_COPY.title}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: '#57534e', marginBottom: 20 }}>
            {RECOVERY_COPY.message}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {reload && (
              <button
                type="button"
                onClick={() => {
                  unstable_retry();
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#f4633a',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {reload.label}
              </button>
            )}
            {exportAction && (
              <a
                href={exportAction.href}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: '2px solid #e7e1d8',
                  color: '#1c1917',
                  fontWeight: 700,
                  textDecoration: 'none',
                }}
              >
                {exportAction.label}
              </a>
            )}
          </div>
        </main>
      </body>
    </html>
  );
}
