import type { Metadata, Viewport } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Remy - AI Field Companion',
  description: 'Voice-first AI that rides along with your field reps.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Remy',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0f14',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="apple-touch-icon" href="/icon-192.png" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <script dangerouslySetInnerHTML={{ __html: `
            window.__remyAudio = null;
            window.__stopRemyAudio = function() {
              if (window.__remyAudio) {
                window.__remyAudio.pause();
                window.__remyAudio.src = '';
                window.__remyAudio = null;
              }
            };
            window.addEventListener('popstate', window.__stopRemyAudio);
            document.addEventListener('click', function(e) {
              var a = e.target.closest('a');
              if (a && a.href) window.__stopRemyAudio();
            }, true);
          ` }} />
        </head>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}