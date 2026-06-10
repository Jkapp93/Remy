import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await req.json();
    const { jobId, repId, messages, summary } = body;
    if (repId) {
      const { userId } = await auth();
      if (!userId || userId !== repId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let companyId = null;
    if (repId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('clerk_id', repId)
        .single();
      companyId = profile?.company_id || null;
    }

    const { error } = await supabase.from('conversations').insert({
      job_id: jobId || null,
      rep_id: repId || null,
      company_id: companyId,
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
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const repId = searchParams.get('repId');

    let query = supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (companyId) query = query.eq('company_id', companyId);
    else if (repId) query = query.eq('rep_id', repId);

    const { data, error } = await query;
    if (error) console.error('Conversations GET error:', error);
    return NextResponse.json({ conversations: data || [] });
  } catch {
    return NextResponse.json({ conversations: [] });
  }
}
