import { describe, it, expect } from 'vitest';
import {
  isStandalone,
  isIOS,
  decideInstallPrompt,
  INSTALL_DISMISS_KEY,
} from '../../src/app/lib/install';

// BC-39 — decide whether/how to invite the user to install the PWA.
// The whole pitch is "an installable PWA you open at the gym", but the app never
// asks. Chromium fires `beforeinstallprompt` (we suppress it + show our own CTA);
// iOS Safari has no such event, so it gets a "Share → Add to Home Screen" hint.
// The trigger/dismissal decision is pure + injectable so the page stays I/O-only.

describe('isStandalone (BC-39)', () => {
  it('is true when the display-mode is standalone (already installed)', () => {
    expect(isStandalone({ displayStandalone: true })).toBe(true);
  });

  it('is true under iOS Safari standalone (navigator.standalone)', () => {
    expect(isStandalone({ displayStandalone: false, navigatorStandalone: true })).toBe(true);
  });

  it('is false in a normal browser tab', () => {
    expect(isStandalone({ displayStandalone: false, navigatorStandalone: false })).toBe(false);
  });
});

describe('isIOS (BC-39)', () => {
  it('detects an iPhone user-agent', () => {
    // mock UA marker — example iOS Safari string
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Example/Test';
    expect(isIOS(ua)).toBe(true);
  });

  it('is false for a desktop Chrome user-agent', () => {
    const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Example/Test Chrome/120';
    expect(isIOS(ua)).toBe(false);
  });

  it('detects an iPadOS 13+ iPad sending a desktop Macintosh UA (touch points)', () => {
    // iPadOS 13+ defaults Safari to desktop mode → reports a Macintosh UA.
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Example/Test Safari';
    expect(isIOS(ua, 5)).toBe(true);
  });

  it('is false for a real Mac (Macintosh UA with no touch screen)', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Example/Test Safari';
    expect(isIOS(ua, 0)).toBe(false);
  });
});

describe('decideInstallPrompt (BC-39)', () => {
  const base = {
    standalone: false,
    hasNativePrompt: false,
    ios: false,
    dismissed: false,
    engaged: true,
  };

  it('shows the native CTA when Chromium offered a prompt', () => {
    expect(decideInstallPrompt({ ...base, hasNativePrompt: true })).toBe('native');
  });

  it('shows the iOS Share-sheet hint when there is no native prompt on iOS', () => {
    expect(decideInstallPrompt({ ...base, ios: true })).toBe('ios-hint');
  });

  it('hides when already installed (standalone), even with a native prompt', () => {
    expect(decideInstallPrompt({ ...base, standalone: true, hasNativePrompt: true })).toBe(
      'hidden',
    );
  });

  it('hides once the user has dismissed the invite', () => {
    expect(decideInstallPrompt({ ...base, hasNativePrompt: true, dismissed: true })).toBe('hidden');
  });

  it('hides on first paint — waits until the user is engaged', () => {
    expect(decideInstallPrompt({ ...base, hasNativePrompt: true, engaged: false })).toBe('hidden');
  });

  it('hides on a desktop browser with no prompt and not iOS', () => {
    expect(decideInstallPrompt(base)).toBe('hidden');
  });
});

describe('INSTALL_DISMISS_KEY (BC-39)', () => {
  it('is a stable namespaced localStorage key', () => {
    expect(INSTALL_DISMISS_KEY).toBe('bc:installPromptDismissed');
  });
});
