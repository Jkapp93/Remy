import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { repId, jobId, rawNote, jobName } = await req.json();
    if (!repId || !rawNote) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Use Claude to structure the note
    const structured = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Extract structured info from this field rep note. Return JSON only, no markdown.
Note: "${rawNote}"
Job: ${jobName || 'Unknown'}

Return: { "summary": "one sentence", "quote_amount": "dollar amount or null", "follow_up_date": "date mentioned or null", "outcome": "sold/no_sale/follow_up/inspection/other", "key_details": ["detail1", "detail2"] }`
      }]
    });

    let parsed: any = {};
    try {
      const text = structured.content[0].type === 'text' ? structured.content[0].text : '{}';
      parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch { parsed = { summary: rawNote }; }

    // Save to job_notes table
    const { data } = await supabase.from('job_notes').insert({
      rep_id: repId,
      job_id: jobId || null,
      raw_note: rawNote,
      summary: parsed.summary,
      quote_amount: parsed.quote_amount,
      follow_up_date: parsed.follow_up_date,
      outcome: parsed.outcome,
      key_details: parsed.key_details,
      created_at: new Date().toISOString(),
    }).select().single();

    // Push to CRM webhook if configured
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id, companies(crm_webhook_url)')
      .eq('clerk_id', repId)
      .single();

    const crmUrl = (profile?.companies as any)?.crm_webhook_url;
    if (crmUrl) {
      fetch(crmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'remy',
          job_id: jobId,
          rep_id: repId,
          note: parsed.summary,
          quote: parsed.quote_amount,
          follow_up: parsed.follow_up_date,
          outcome: parsed.outcome,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, note: data, structured: parsed });
  } catch (error) {
    console.error('Notes error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const repId = searchParams.get('repId');

  let query = supabase.from('job_notes').select('*').order('created_at', { ascending: false }).limit(20);
  if (jobId) query = query.eq('job_id', jobId);
  else if (repId) query = query.eq('rep_id', repId);

  const { data } = await query;
  return NextResponse.json({ notes: data || [] });
}
