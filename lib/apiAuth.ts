import { auth } from '@clerk/nextjs/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';

// Resolves which company a request is allowed to see. Order:
// 1. Clerk session (web dashboard)
// 2. Mobile bearer token (internal field app — maps to MOBILE_COMPANY_ID)
// Returns null when nothing identifies the caller — routes must return
// EMPTY results in that case, never unscoped data.
//
// NOTE: a bare ?clerkId= query param is deliberately NOT accepted. Clerk ids
// appear in client code and logs; trusting them unauthenticated lets anyone
// read another company's data. Web callers always have the session cookie,
// so the param was redundant for every legitimate caller.
export async function resolveCompanyId(req: NextRequest, supabase: SupabaseClient): Promise<string | null> {
  const { userId } = await auth();
  if (userId) {
    const { data } = await supabase.from('profiles').select('company_id').eq('clerk_id', userId).single();
    if (data?.company_id) return data.company_id;
  }

  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (bearer && process.env.MOBILE_API_TOKEN && bearer === process.env.MOBILE_API_TOKEN) {
    return process.env.MOBILE_COMPANY_ID || null;
  }

  return null;
}
