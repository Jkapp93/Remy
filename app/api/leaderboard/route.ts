import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveCompanyId } from '@/lib/apiAuth';

// Same static-freeze risk as timeline: error before dynamic API + 200 catch.
export const dynamic = 'force-dynamic';

// Weekly rep performance stats. Replaces Leaderboard.tsx's direct
// anon-key Supabase reads (which were also unscoped on job_notes —
// they counted every company's notes).
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const companyId = await resolveCompanyId(req, supabase);
    if (!companyId) return NextResponse.json({ stats: [] });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    const { data: profiles } = await supabase.from('profiles').select('clerk_id, full_name').eq('company_id', companyId);
    if (!profiles?.length) return NextResponse.json({ stats: [] });
    const repIds = profiles.map(p => p.clerk_id);

    const [convosRes, notesRes] = await Promise.all([
      supabase.from('conversations').select('rep_id').eq('company_id', companyId).gte('created_at', weekAgoStr),
      supabase.from('job_notes').select('rep_id, outcome').in('rep_id', repIds).gte('created_at', weekAgoStr),
    ]);
    const convos = convosRes.data || [];
    const notes = notesRes.data || [];

    const stats = profiles.map(p => {
      const repConvos = convos.filter((c: any) => c.rep_id === p.clerk_id).length;
      const repNotes = notes.filter((n: any) => n.rep_id === p.clerk_id).length;
      const repSold = notes.filter((n: any) => n.rep_id === p.clerk_id && n.outcome === 'sold').length;
      const repFollowUps = notes.filter((n: any) => n.rep_id === p.clerk_id && n.outcome === 'follow_up').length;
      const score = repConvos * 1 + repNotes * 2 + repSold * 5 + repFollowUps * 1;
      return {
        repId: p.clerk_id,
        name: p.full_name || 'Unknown Rep',
        conversations: repConvos,
        notes: repNotes,
        sold: repSold,
        followUps: repFollowUps,
        score,
      };
    }).sort((a, b) => b.score - a.score);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Leaderboard error:', error);
    return NextResponse.json({ stats: [] });
  }
}
