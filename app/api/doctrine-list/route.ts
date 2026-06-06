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

    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && clerkId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('clerk_id', clerkId)
        .single();
      resolvedCompanyId = profile?.company_id || null;
    }

    let query = supabase.from('doctrine').select('content').eq('active', true);
    if (resolvedCompanyId) query = query.eq('company_id', resolvedCompanyId);

    const { data } = await query;
    const doctrine = data ? data.map((d: {content: string}) => d.content).join('\n') : '';
    return NextResponse.json({ doctrine });
  } catch (error) {
    console.error('Doctrine error:', error);
    return NextResponse.json({ doctrine: '' });
  }
}
