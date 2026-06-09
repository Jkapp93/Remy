import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

async function getCompanyId(repId: string, supabase: any): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('company_id').eq('clerk_id', repId).single();
  return data?.company_id || null;
}

export async function POST(req: NextRequest) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { messages, repId, jobContext } = await req.json();
    if (repId) {
      const { userId } = await auth();
      if (!userId || userId !== repId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!messages || messages.length < 2) return NextResponse.json({ success: false });

    const conversationText = messages
      .map((m: {role: string; content: string}) => `${m.role === 'user' ? 'Rep' : 'Remy'}: ${m.content}`)
      .join('\n');

    const summaryResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Summarize this field sales conversation in 2-3 sentences. Focus on: what job it was, what objections came up, what tactics worked, and any follow-up needed.\n\nConversation:\n${conversationText}\n\nJob context: ${jobContext || 'None'}`
      }]
    });

    const summary = summaryResponse.content[0].type === 'text' ? summaryResponse.content[0].text : '';
    const companyId = repId ? await getCompanyId(repId, supabase) : null;

    if (repId && summary) {
      await supabase.from('rep_memory').insert({
        rep_id: repId,
        content: summary,
        source: 'conversation',
        company_id: companyId,
      });
    }

    return NextResponse.json({ success: true, summary });
  } catch (error) {
    console.error('Memory error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(req.url);
    const repId = searchParams.get('repId');
    if (!repId) return NextResponse.json({ memories: [] });

    // Fetch synthesis insight first (highest signal), then recent conversation/outcome memories
    const [synthData, recentData] = await Promise.all([
      supabase.from('rep_memory').select('content').eq('rep_id', repId).eq('source', 'synthesis').single(),
      supabase.from('rep_memory').select('content, created_at').eq('rep_id', repId).in('source', ['conversation', 'outcome']).order('created_at', { ascending: false }).limit(8),
    ]);

    const synthMemory = synthData.data ? [{ content: `[Pattern insight] ${synthData.data.content}` }] : [];
    const data = [...synthMemory, ...(recentData.data || [])];

    return NextResponse.json({ memories: data || [] });
  } catch {
    return NextResponse.json({ memories: [] });
  }
}
