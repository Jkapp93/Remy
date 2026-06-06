import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
const isPublicRoute = createRouteMatcher([
  '/',
  '/auth(.*)',
  '/api/webhook(.*)',
  '/api/voice(.*)',
  '/api/chat(.*)',
  '/api/jobs(.*)',
  '/api/doctrine-list(.*)',
  '/api/transcribe(.*)',
]);
export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth.protect();
  }
});
export const config = {
  matcher: ['/((?!.+\\.[\\w]+$|_next).*)', '/', '/(api|trpc)(.*)'],
};