import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveCompanyId } from '@/lib/apiAuth';

// Build-time prerender once froze this route as a static 200 with empty
// events (createClient threw before any dynamic API ran, the catch swallowed
// it). force-dynamic guarantees it always executes per-request.
export const dynamic = 'force-dynamic';

// Timeline events (notes + conversations) for a job. Replaces the
// dashboard's direct anon-key Supabase reads.
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const companyId = await resolveCompanyId(req, supabase);
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const jobId = new URL(req.url).searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 });

    // The job must belong to the caller's company
    const { data: job } = await supabase.from('jobs').select('company_id').eq('id', jobId).single();
    if (!job || job.company_id !== companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const [notesRes, convosRes] = await Promise.all([
      supabase.from('job_notes').select('*').eq('job_id', jobId).order('created_at', { ascending: true }),
      supabase.from('conversations').select('*').eq('job_id', jobId).order('created_at', { ascending: true }),
    ]);

    const notes = (notesRes.data || []).map((n: any) => ({ ...n, type: 'note' }));
    const convos = (convosRes.data || []).map((c: any) => ({ ...c, type: 'conversation' }));
    const events = [...notes, ...convos].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Timeline error:', error);
    return NextResponse.json({ events: [] });
  }
}
