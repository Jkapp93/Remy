import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Remy - AI Co-Pilot for Home Services Reps',
  description: 'Pre-job briefs, live objection coaching, weather intel, and GPS co-pilot. Built for home services field reps.',
  openGraph: {
    title: 'Remy - AI Co-Pilot for Home Services Reps',
    description: 'Pre-job briefs, live objection coaching, weather intel, and GPS co-pilot.',
    url: 'https://remy-nu.vercel.app',
    siteName: 'Remy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Remy - AI Co-Pilot for Home Services Reps',
    description: 'Pre-job briefs, live objection coaching, weather intel, and GPS co-pilot.',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      signInFallbackRedirectUrl="/dashboard"
    >
      <html lang="en">
        <head>
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
          <meta name="theme-color" content="#0b0f14" />
          <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        </head>
        <body style={{ margin: 0, padding: 0, background: '#0b0f14' }}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
