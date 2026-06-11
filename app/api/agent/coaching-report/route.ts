// app/api/agent/coaching-report/route.ts
// Analyzes rep conversations and generates coaching insights
// Zeus calls this nightly for each rep

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { resolveCompanyId } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const callerCompanyId = await resolveCompanyId(req, supabase);
    if (!callerCompanyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { repId, companyId } = await req.json();
    if (!repId) return NextResponse.json({ error: 'Missing repId' }, { status: 400 });
    // The rep being coached must belong to the caller's company
    const { data: repProfile } = await supabase.from('profiles').select('company_id').eq('clerk_id', repId).single();
    if (!repProfile || repProfile.company_id !== callerCompanyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get recent conversations and notes
    const [convosRes, notesRes, profileRes] = await Promise.all([
      supabase.from('conversations').select('summary, created_at').eq('rep_id', repId).gte('created_at', weekAgo.toISOString()).order('created_at', { ascending: false }).limit(20),
      supabase.from('job_notes').select('*').eq('rep_id', repId).gte('created_at', weekAgo.toISOString()),
      supabase.from('profiles').select('full_name').eq('clerk_id', repId).single(),
    ]);

    const convos = convosRes.data || [];
    const notes = notesRes.data || [];
    const repName = profileRes.data?.full_name || 'this rep';

    if (!convos.length && !notes.length) {
      return NextResponse.json({ success: true, report: null, message: 'No activity this week' });
    }

    const sold = notes.filter((n: any) => n.outcome === 'sold').length;
    const noSale = notes.filter((n: any) => n.outcome === 'no_sale').length;
    const followUp = notes.filter((n: any) => n.outcome === 'follow_up').length;
    const closeRate = sold + noSale > 0 ? Math.round((sold / (sold + noSale)) * 100) : 0;

    const convoSummaries = convos.map((c: any) => c.summary).filter(Boolean).join('\n');
    const noteSummaries = notes.map((n: any) => n.summary).filter(Boolean).join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are a field sales coach. Analyze this rep's week and give specific coaching. Return JSON only.

Rep: ${repName}
Closed: ${sold} deals
No Sales: ${noSale}
Follow-ups: ${followUp}
Close Rate: ${closeRate}%
Conversation summaries: ${convoSummaries.slice(0, 500)}
Note summaries: ${noteSummaries.slice(0, 500)}

Return: {
  "score": 1-10,
  "headline": "one sentence summary of their week",
  "strength": "one specific thing they did well",
  "coaching": "one specific thing to improve with exact words to use",
  "nextWeekFocus": "one actionable focus for next week"
}`
      }]
    });

    let report: any = {};
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      report = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch { report = { score: 5, headline: 'Solid week in the field.', strength: 'Consistent activity.', coaching: 'Focus on closing faster.', nextWeekFocus: 'Follow up on all open leads.' }; }

    // Push coaching report to rep's feed
    await supabase.from('conversations').insert({
      rep_id: repId,
      company_id: companyId,
      summary: `[WEEKLY COACHING] Score: ${report.score}/10 â€” ${report.headline} Focus: ${report.coaching}`,
      created_at: new Date().toISOString(),
    });

    // Update rep memory with coaching insight
    const existing = await supabase.from('rep_memory').select('content').eq('rep_id', repId).single();
    const newMemory = `Week of ${new Date().toLocaleDateString()}: Score ${report.score}/10. ${report.strength} Coaching: ${report.coaching}`;
    const content = existing.data?.content ? existing.data.content + '\n' + newMemory : newMemory;
    await supabase.from('rep_memory').upsert({ rep_id: repId, company_id: companyId, content }, { onConflict: 'rep_id' });

    return NextResponse.json({ success: true, report: { ...report, sold, noSale, followUp, closeRate, repName } });
  } catch (error) {
    console.error('Coaching error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
