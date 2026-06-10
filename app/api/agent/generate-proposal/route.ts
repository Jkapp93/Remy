// app/api/agent/generate-proposal/route.ts
// Generates a professional PDF proposal after a job session
// Zeus calls this after rep logs an outcome or quote

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const { jobId, repId, companyId } = await req.json();
    if (!jobId) return NextResponse.json({ error: 'Missing jobId' }, { status: 400 });

    // Get job details
    const { data: job } = await supabase.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    // Get latest notes for this job
    const { data: notes } = await supabase.from('job_notes').select('*').eq('job_id', jobId).order('created_at', { ascending: false }).limit(5);

    // Get company info
    const { data: company } = await supabase.from('companies').select('*').eq('id', companyId || job.company_id).single();

    // Get doctrine for pricing/warranty info
    const { data: doctrine } = await supabase.from('doctrine').select('content').eq('active', true).eq('company_id', companyId || job.company_id);
    const docText = (doctrine || []).map((d: any) => d.content).join('\n').slice(0, 1000);

    const noteSummary = (notes || []).map((n: any) => `- ${n.summary || n.raw_note}`).join('\n');
    const quoteAmount = (notes || []).find((n: any) => n.quote_amount)?.quote_amount;

    // Generate proposal content via Claude
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `Generate a professional proposal for a home services job. Return JSON only, no markdown.

Company: ${company?.name || 'Our Company'}
Customer: ${job.customer_name}
Address: ${job.address || 'On file'}
Job Type: ${job.job_type}
Quote Amount: ${quoteAmount || 'To be determined'}
Notes: ${noteSummary || 'Initial assessment completed'}
Company Info: ${docText}

Return: {
  "title": "Proposal title",
  "intro": "2 sentence professional intro",
  "scope": ["item 1", "item 2", "item 3"],
  "warranty": "warranty statement",
  "financing": "financing options if applicable",
  "closing": "1 sentence professional closing",
  "validDays": 30
}`
      }]
    });

    let proposal: any = {};
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      proposal = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch { proposal = { title: `${job.job_type} Proposal`, intro: 'Thank you for the opportunity.', scope: [job.notes || 'Work as discussed'], warranty: '1 year workmanship warranty', closing: 'We look forward to working with you.' }; }

    // Save proposal to job notes
    await supabase.from('job_notes').insert({
      rep_id: repId,
      job_id: jobId,
      raw_note: `Proposal generated: ${proposal.title}`,
      summary: `Auto-proposal generated for ${job.customer_name}. Quote: ${quoteAmount || 'TBD'}`,
      outcome: 'proposal_sent',
      key_details: proposal.scope,
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true, 
      proposal: {
        ...proposal,
        customer: job.customer_name,
        address: job.address,
        jobType: job.job_type,
        quoteAmount,
        company: company?.name,
        date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        validUntil: new Date(Date.now() + (proposal.validDays || 30) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      }
    });
  } catch (error) {
    console.error('Proposal error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
