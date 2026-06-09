import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(req.url);
    const clerkId = searchParams.get('clerkId');
    if (!clerkId) return NextResponse.json({ error: 'clerkId required' }, { status: 400 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('clerk_id', clerkId)
      .single();

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const companyId = profile.company_id;

    const [jobRes, docRes, profileRes, inviteRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50),
      supabase.from('doctrine').select('*').eq('active', true).eq('company_id', companyId).order('created_at', { ascending: false }),
      companyId
        ? supabase.from('profiles').select('*').eq('company_id', companyId)
        : Promise.resolve({ data: [] }),
      companyId
        ? supabase.from('invites').select('*').eq('company_id', companyId).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    return NextResponse.json({
      profile,
      company: profile.companies,
      jobs: jobRes.data || [],
      doctrine: docRes.data || [],
      profiles: profileRes.data || [],
      invites: inviteRes.data || [],
    });
  } catch (error) {
    console.error('Boss data error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
