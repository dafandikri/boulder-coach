// BC-33 — copy + actions for the crash-recovery screens (error.tsx / global-error.tsx).
// Logic lives here (covered) so the gate-blind boundary components only render. The
// guiding rule: a crash on a single-device app holding irreplaceable data must never be
// a dead white screen — reassure, offer reload + export, and NEVER expose a raw stack.

export interface RecoveryAction {
  label: string;
  /** 'reload' re-runs the segment / reloads the app; 'link' navigates (e.g. to export). */
  kind: 'reload' | 'link';
  href?: string;
}

export const RECOVERY_COPY = {
  title: 'Something broke',
  message:
    'Your training data is safe on this device. Try reloading — and if it keeps happening, ' +
    'export a backup so nothing can be lost.',
} as const;

export const RECOVERY_ACTIONS: RecoveryAction[] = [
  { label: 'Reload', kind: 'reload' },
  { label: 'Export your data', kind: 'link', href: '/profile' },
];

const MAX_DIGEST = 140;

/**
 * A short, stack-free reference for a thrown value — safe to log or show. Returns
 * `name: message` for an Error (truncated, single-line), never the stack trace, and
 * a neutral label for anything that isn't an Error.
 */
export function safeErrorDigest(error: unknown): string {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`.replace(/\s+/g, ' ').trim().slice(0, MAX_DIGEST);
  }
  return 'Unknown error';
}
