import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { resolveCompanyId } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { jobId, summary } = body;

    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('clerk_id', userId)
      .single();

    const { error } = await supabase.from('conversations').insert({
      job_id: jobId || null,
      rep_id: userId,
      company_id: profile?.company_id || null,
      summary: summary || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Conversation insert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Conversation log error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const companyId = await resolveCompanyId(req, supabase);
    if (!companyId) return NextResponse.json({ conversations: [] });

    const { searchParams } = new URL(req.url);
    const repId = searchParams.get('repId');

    let query = supabase
      .from('conversations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (repId) query = query.eq('rep_id', repId);

    const { data, error } = await query;
    if (error) console.error('Conversations GET error:', error);
    return NextResponse.json({ conversations: data || [] });
  } catch {
    return NextResponse.json({ conversations: [] });
  }
}
