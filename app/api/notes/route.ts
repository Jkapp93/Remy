import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';

const isAllowedCrmWebhookUrl = (crmWebhookUrl: string | null) => {
  if (!crmWebhookUrl) return false;

  let parsed: URL;
  try {
    parsed = new URL(crmWebhookUrl);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    return false;
  }

  const ipParts = host.split('.').map((part) => Number(part));
  if (ipParts.length === 4 && ipParts.every((part) => Number.isFinite(part) && part >= 0 && part <= 255)) {
    // Block private IP ranges in common cases
    if (
      ipParts[0] === 10 ||
      (ipParts[0] === 172 && ipParts[1] >= 16 && ipParts[1] <= 31) ||
      (ipParts[0] === 192 && ipParts[1] === 168)
    ) {
      return false;
    }
  }

  return true;
};

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const { userId } = await auth();
    const { repId, jobId, rawNote, jobName } = await req.json();
    if (!repId || !rawNote) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    if (!userId || userId !== repId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (rawNote.length > 2000) return NextResponse.json({ error: 'Note too long' }, { status: 400 });

    // Use Claude to structure the note
    const structured = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Extract structured info from this field rep note. Return JSON only, no markdown.\nNote: "${rawNote}"\nJob: ${jobName || 'Unknown'}\n\nReturn: { "summary": "one sentence", "quote_amount": "dollar amount or null", "follow_up_date": "date mentioned or null", "outcome": "sold/no_sale/follow_up/inspection/other", "key_details": ["detail1", "detail2"] }`
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
    if (crmUrl && isAllowedCrmWebhookUrl(crmUrl)) {
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get('jobId');
  const repId = searchParams.get('repId');
  const companyId = searchParams.get('companyId');

  const { userId } = await auth();
  if (!userId) return NextResponse.json({ notes: [] }, { status: 401 });

  const { data: userProfile, error: userProfileError } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('clerk_id', userId)
    .single();

  if (userProfileError || !userProfile?.company_id) {
    return NextResponse.json({ notes: [] }, { status: 403 });
  }

  if (repId && repId !== userId) {
    return NextResponse.json({ notes: [] }, { status: 401 });
  }

  if (companyId && companyId !== userProfile.company_id) {
    return NextResponse.json({ notes: [] }, { status: 403 });
  }

  let query = supabase.from('job_notes').select('*').order('created_at', { ascending: false }).limit(50);

  if (jobId) {
    // The job's notes are only visible to members of the company that owns it
    const { data: jobRow } = await supabase
      .from('jobs')
      .select('company_id')
      .eq('id', jobId)
      .single();
    if (!jobRow || jobRow.company_id !== userProfile.company_id) {
      return NextResponse.json({ notes: [] }, { status: 403 });
    }
    query = query.eq('job_id', jobId);
  } else if (repId) {
    query = query.eq('rep_id', repId);
  } else if (companyId) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('clerk_id')
      .eq('company_id', companyId);

    const repIds = (profiles || []).map((p: any) => p.clerk_id).filter(Boolean);

    if (repIds.length === 0) {
      return NextResponse.json({ notes: [] });
    }

    query = query.in('rep_id', repIds);
  } else {
    query = query.eq('rep_id', userId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }

  return NextResponse.json({ notes: data || [] });
}
