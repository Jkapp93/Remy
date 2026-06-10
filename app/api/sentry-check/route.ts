// Intentional crash endpoint to verify Sentry capture works end-to-end.
// Throws uncaught so instrumentation.onRequestError reports it.
export async function GET() {
  throw new Error('Sentry verification: if you can read this in Sentry, the pipeline works');
}
