import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Vercel cron calls this with a secret header — reject everything else
function isAuthorized(req: NextRequest): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find all reps who have new outcome memories in the last 7 days
    const { data: activeReps } = await supabase
      .from('rep_memory')
      .select('rep_id, company_id')
      .eq('source', 'outcome')
      .gte('created_at', sevenDaysAgo);

    if (!activeReps?.length) return NextResponse.json({ processed: 0 });

    // Deduplicate rep IDs
    const unique = [...new Map(activeReps.map(r => [r.rep_id, r])).values()];
    let processed = 0;

    for (const { rep_id, company_id } of unique) {
      try {
        // Get their last 30 memories (conversation + outcome)
        const { data: memories } = await supabase
          .from('rep_memory')
          .select('content, source, created_at')
          .eq('rep_id', rep_id)
          .in('source', ['conversation', 'outcome'])
          .order('created_at', { ascending: false })
          .limit(30);

        if (!memories?.length) continue;

        const memText = memories.map(m => `[${m.source}] ${m.content}`).join('\n');

        const res = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 120,
          messages: [{
            role: 'user',
            content: `You are analyzing a field sales rep's recent activity. Based on these memories, write 2 short coaching insights — patterns you see in their wins/losses/objections. Plain sentences only, no bullets. Under 100 words total. Be specific and actionable.

${memText}`,
          }],
        });

        const insight = res.content[0].type === 'text' ? res.content[0].text.trim() : '';
        if (!insight) continue;

        // Replace old synthesis memory for this rep (upsert pattern: delete then insert)
        await supabase.from('rep_memory').delete().eq('rep_id', rep_id).eq('source', 'synthesis');
        await supabase.from('rep_memory').insert({
          rep_id,
          company_id,
          content: insight,
          source: 'synthesis',
        });
        processed++;
      } catch { /* skip this rep, continue */ }
    }

    return NextResponse.json({ processed, total: unique.length });
  } catch (error) {
    console.error('Synthesis cron error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
