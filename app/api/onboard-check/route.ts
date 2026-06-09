import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
