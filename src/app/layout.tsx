import type { Metadata } from 'next';
// Self-hosted Geist fonts (Vercel's `geist` pkg) — bundled .woff2, NO build-time
// network fetch. `next/font/google` downloaded from fonts.gstatic.com at build
// time, making `next build` (gate step 8/8) flaky on any network blip. See
// docs/LEARNINGS.md 2026-06-10. Sets --font-geist-sans / --font-geist-mono.
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { BottomNav } from './components/BottomNav';

export const metadata: Metadata = {
  title: 'Boulder Coach',
  description: 'Your adaptive bouldering training program',
  manifest: '/manifest.webmanifest',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Mobile-first column (max 28rem) with room for the fixed bottom nav. */}
        <div className="mx-auto flex min-h-dvh w-full max-w-[28rem] flex-col pb-24">{children}</div>
        <BottomNav />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </body>
    </html>
  );
}
