import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveCompanyId } from '@/lib/apiAuth';

// Same static-freeze risk as timeline: error before dynamic API + 200 catch.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const resolvedCompanyId = await resolveCompanyId(req, supabase);
    if (!resolvedCompanyId) return NextResponse.json({ doctrine: '' });

    const { data } = await supabase
      .from('doctrine')
      .select('content')
      .eq('active', true)
      .eq('company_id', resolvedCompanyId);
    const doctrine = data ? data.map((d: {content: string}) => d.content).join('\n') : '';
    return NextResponse.json({ doctrine });
  } catch (error) {
    console.error('Doctrine error:', error);
    return NextResponse.json({ doctrine: '' });
  }
}
