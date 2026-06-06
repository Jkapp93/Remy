import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Middleware-style check â€” used by onboard page to redirect if already onboarded
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clerkId = searchParams.get('clerkId');
  if (!clerkId) return NextResponse.json({ onboarded: false });

  const { data } = await supabase
    .from('profiles')
    .select('role, company_id')
    .eq('clerk_id', clerkId)
    .single();

  if (data?.company_id) {
    return NextResponse.json({ 
      onboarded: true, 
      role: data.role,
      redirect: data.role === 'owner' ? '/boss' : '/dashboard/voice'
    });
  }
  return NextResponse.json({ onboarded: false });
}
