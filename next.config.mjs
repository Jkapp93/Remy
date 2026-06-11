import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Remy uses the mic (voice) and geolocation (GPS co-pilot); camera stays off.
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'kapp-apps',
  project: 'remy',
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
});
