/**
 * Honest async-load states (BC-12).
 *
 * A `page.tsx` that awaits a repo promise must render one of a *fixed* set of
 * states — never a silent infinite "Loading…" when the promise rejects, and
 * never a dead-end when the data is simply absent. The DECISION of which state
 * to show is logic, so it lives here (a gate-covered layer) rather than inline
 * in the gate-blind component. The page only renders what these builders return.
 */

/** Outcome of an awaited load: either the data, or the thrown reason. */
export type LoadResult<T> = { ok: true; data: T } | { ok: false; error: unknown };

/** A load that, on success, always carries data (e.g. getTodaySession). */
export type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T };

/** A load whose success may be absent — `undefined`/`null` is a real "empty"
 *  (recoverable) state, distinct from an error. e.g. getActiveProgram(). */
export type OptionalLoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'ready'; data: T };

const GENERIC_ERROR = 'Something went wrong. Please try again.';

function messageOf(error: unknown): string {
  return error instanceof Error && error.message.length > 0 ? error.message : GENERIC_ERROR;
}

/** Map a settled load (always-present data) to a ready/error state. */
export function toLoadState<T>(result: LoadResult<T>): LoadState<T> {
  if (result.ok) return { status: 'ready', data: result.data };
  return { status: 'error', message: messageOf(result.error) };
}

/** Map a settled load (data may be absent) to a ready/empty/error state. */
export function toOptionalLoadState<T>(
  result: LoadResult<T | null | undefined>,
): OptionalLoadState<T> {
  if (!result.ok) return { status: 'error', message: messageOf(result.error) };
  const { data } = result;
  if (data === null || data === undefined) return { status: 'empty' };
  return { status: 'ready', data };
}
