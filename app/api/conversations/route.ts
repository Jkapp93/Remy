import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { jobId, repId, messages, summary } = await req.json();

    await supabase.from('conversations').insert({
      job_id: jobId || null,
      rep_id: repId || null,
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

    let query = supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (jobId) query = query.eq('job_id', jobId);
    if (repId) query = query.eq('rep_id', repId);

    const { data } = await query;
    return NextResponse.json({ conversations: data || [] });
  } catch (error) {
    console.error('Conversation fetch error:', error);
    return NextResponse.json({ conversations: [] });
  }
}
