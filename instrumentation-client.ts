import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // No session replay: rep conversations are sensitive and this is a voice app.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
