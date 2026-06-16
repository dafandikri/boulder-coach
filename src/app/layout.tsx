import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BottomNav } from './components/BottomNav';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: 'Boulder Coach',
  description: 'Your adaptive bouldering training program',
  manifest: '/manifest.webmanifest',
  // BC-14: branded maskable PNGs + apple-touch-icon so install-to-home-screen looks finished.
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

// BC-61: an installed iOS PWA reports env(safe-area-inset-*) as 0 UNLESS the
// viewport declares viewport-fit=cover. BottomNav already pads with
// env(safe-area-inset-bottom); without this export Next injected only its default
// viewport, the inset collapsed to 0, and the tab bar crowded the home indicator.
// Declaring `cover` activates the insets (we add a top inset on the column below so
// content doesn't slide under the status bar/notch in standalone mode).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

// Brand webfonts (Baloo 2 / Nunito / Space Mono) load via a real document <link>
// — NOT a CSS `@import`, and NOT `next/font/google`. Why a <link>: a CSS @import
// is only valid *before all other rules*, so once Next bundles globals.css behind
// any other package's @font-face the production CSS optimizer silently DROPS it,
// and the app falls back to system fonts (looks generic/"bland" — the BC-23 bug).
// A <link> is immune to CSS bundling. Why not next/font/google: that fetches from
// fonts.gstatic.com AT BUILD TIME, which flaked the offline `build` gate twice
// (banned by tests/build/deterministic-fonts.test.ts). React 19 hoists this <link>
// to <head>; the browser fetches at runtime, so the build stays deterministic.
// See docs/LEARNINGS.md 2026-06-12.
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,600;1,700&family=Space+Mono:wght@400;700&display=swap';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        {/* BC-25 — set the theme before first paint to avoid a light→dark flash.
            Runs synchronously as the first thing in <body>: an explicit stored
            choice wins, else the OS prefers-color-scheme. This is the canonical
            logic from src/app/lib/theme.ts (resolveTheme + applyTheme), inlined
            in plain JS because it must run before the bundle loads — keep the two
            in sync. The toggle (profile → Appearance) drives it at runtime. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement,t=localStorage.getItem('bc:theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}d.setAttribute('data-theme',t);d.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_HREF} />
        {/* Mobile-first column (max 28rem) with room for the fixed bottom nav.
            BC-61: pad the top by env(safe-area-inset-top) so that, once viewport-fit=cover
            is on, content stays clear of the status bar/notch in a standalone iOS PWA. */}
        <div
          className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col pb-24"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          {children}
        </div>
        <BottomNav />
        <SpeedInsights />
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
