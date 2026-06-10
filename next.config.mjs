import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default withSentryConfig(nextConfig, {
  org: 'kapp-apps',
  project: 'remy',
  silent: true,
  widenClientFileUpload: true,
  disableLogger: true,
});
