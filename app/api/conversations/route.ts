import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getCompanyId(repId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('company_id').eq('clerk_id', repId).single();
  return data?.company_id || null;
}

export async function POST(req: NextRequest) {
  try {
    const { jobId, repId, messages, summary } = await req.json();
    const companyId = repId ? await getCompanyId(repId) : null;

    await supabase.from('conversations').insert({
      job_id: jobId || null,
      rep_id: repId || null,
      company_id: companyId,
      messages: JSON.stringify(messages),
      summary: summary || null,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Conversation log error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const repId = searchParams.get('repId');
    const companyId = searchParams.get('companyId');

    let query = supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (companyId) query = query.eq('company_id', companyId);
    else if (jobId) query = query.eq('job_id', jobId);
    else if (repId) query = query.eq('rep_id', repId);

    const { data } = await query;
    return NextResponse.json({ conversations: data || [] });
  } catch {
    return NextResponse.json({ conversations: [] });
  }
}
