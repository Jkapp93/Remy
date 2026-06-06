import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const clerkId = searchParams.get('clerkId');

    // If clerkId provided, look up their company
    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && clerkId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('clerk_id', clerkId)
        .single();
      resolvedCompanyId = profile?.company_id || null;
    }

    let query = supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false });
    if (resolvedCompanyId) query = query.eq('company_id', resolvedCompanyId);

    const { data } = await query;
    return NextResponse.json({ jobs: data || [] });
  } catch (error) {
    console.error('Jobs error:', error);
    return NextResponse.json({ jobs: [] });
  }
}
