// BC-31 — request durable storage and decide whether to warn about eviction.
// All training history lives in evictable IndexedDB (BC-10 named this the
// data-loss risk); the cheapest durability win before cloud sync (BC-18) is to
// ask the browser to persist the origin's storage. The decision logic is pure
// and injectable so it's covered by tests — the page only does the localStorage
// I/O and feeds in the real `navigator.storage`.

/**
 * The slice of the Storage API we depend on. The real `navigator.storage`
 * satisfies this structurally at the call site, while tests pass a fake — so the
 * decision logic stays in covered code instead of the gate-blind page.
 */
export interface StorageManagerLike {
  persist?: () => Promise<boolean>;
  persisted?: () => Promise<boolean>;
}

/**
 * Known durability of the origin's storage:
 * - `persisted`  — durable; the browser won't evict it under storage pressure.
 * - `transient`  — evictable; a durable request was made but denied.
 * - `unsupported` — the Storage API (or `persist`) is unavailable, so we can't tell.
 */
export type PersistenceState = 'persisted' | 'transient' | 'unsupported';

/** localStorage key recording that the user dismissed the eviction-risk banner. */
export const EVICTION_DISMISS_KEY = 'bc:evictionWarnDismissed';

/**
 * Request durable storage and report the resulting state. `persist()` both asks
 * for persistence and returns whether the origin is now durable, so one call
 * covers the check. Feature-detects and degrades silently: a browser without the
 * Storage API is `unsupported` (no request, no warning).
 */
export async function requestPersistence(
  storage: StorageManagerLike | undefined,
): Promise<PersistenceState> {
  if (!storage || typeof storage.persist !== 'function') return 'unsupported';
  const granted = await storage.persist();
  return granted ? 'persisted' : 'transient';
}

/**
 * Whether to surface the eviction-risk banner: only when storage is known
 * `transient` (a durable request was denied) AND the user hasn't dismissed it.
 * `unsupported` stays quiet — we can't measure the risk, so we don't cry wolf.
 */
export function shouldWarnEviction(state: PersistenceState, dismissed: boolean): boolean {
  return state === 'transient' && !dismissed;
}
