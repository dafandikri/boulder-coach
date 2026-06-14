// BC-39 — decide whether/how to invite the user to install the PWA.
// The product's pitch is "an installable PWA you open at the gym", yet the app
// never invites the install — it relies on the browser's easy-to-miss default.
// Chromium fires `beforeinstallprompt` (we suppress it and surface our own CTA);
// iOS Safari has no such event, so it gets a "Share → Add to Home Screen" hint.
// All the trigger/dismissal logic lives here (covered) so the page only does the
// DOM/localStorage I/O and feeds in the captured event + display/UA signals.

/** localStorage key recording that the user dismissed the install invite. */
export const INSTALL_DISMISS_KEY = 'bc:installPromptDismissed';

/**
 * The slice of the (non-standard) `BeforeInstallPromptEvent` we depend on. The
 * real Chromium event satisfies this structurally at the call site; tests pass a
 * fake — so the decision logic stays in covered code, not the gate-blind page.
 */
export interface InstallPromptEventLike {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * What the page should render:
 * - `native`   — Chromium gave us a deferred prompt; show a CTA that triggers it.
 * - `ios-hint` — iOS Safari (no prompt event); show the manual Share-sheet hint.
 * - `hidden`   — already installed, dismissed, not yet engaged, or unsupported.
 */
export type InstallPromptDecision = 'native' | 'ios-hint' | 'hidden';

/**
 * Whether the app is running as an installed PWA (standalone display). Covers
 * both the standard `display-mode: standalone` media query and iOS Safari's
 * non-standard `navigator.standalone`. An installed app never sees the invite.
 */
export function isStandalone(opts: {
  displayStandalone: boolean;
  navigatorStandalone?: boolean;
}): boolean {
  return opts.displayStandalone || opts.navigatorStandalone === true;
}

/**
 * iOS has no `beforeinstallprompt`, so we detect it to show the Share hint
 * instead. iPadOS 13+ defaults Safari to "desktop mode", which reports a
 * *Macintosh* UA — so a touch-capable "Mac" (real Macs report `maxTouchPoints`
 * 0) is really an iPad and still needs the manual hint.
 */
export function isIOS(userAgent: string, maxTouchPoints = 0): boolean {
  if (/iphone|ipad|ipod/i.test(userAgent)) return true;
  return /macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/**
 * Decide whether/how to surface the install invite. Precedence: never invite an
 * already-installed app, a user who dismissed it, or before they're engaged
 * (no nagging on first paint). Then prefer the native Chromium prompt; fall back
 * to the iOS manual hint; otherwise stay hidden (unsupported browser).
 */
export function decideInstallPrompt(input: {
  standalone: boolean;
  hasNativePrompt: boolean;
  ios: boolean;
  dismissed: boolean;
  engaged: boolean;
}): InstallPromptDecision {
  if (input.standalone || input.dismissed || !input.engaged) return 'hidden';
  if (input.hasNativePrompt) return 'native';
  if (input.ios) return 'ios-hint';
  return 'hidden';
}
