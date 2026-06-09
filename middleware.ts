import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
const isPublicRoute = createRouteMatcher([
  '/',
  '/auth(.*)',
  '/onboard(.*)',
  '/pricing(.*)',
  '/demo(.*)',
  '/api/webhook(.*)',
  '/api/voice(.*)',
  '/api/chat(.*)',
  '/api/jobs(.*)',
  '/api/doctrine-list(.*)',
  '/api/transcribe(.*)',
  '/api/invite(.*)',
  '/api/onboard(.*)',
  '/api/onboard-check(.*)',
  '/api/conversations(.*)',
  '/api/memory(.*)',
  '/api/rate-limit(.*)',
  '/api/notes(.*)',
]);
export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth.protect();
  }
});
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};