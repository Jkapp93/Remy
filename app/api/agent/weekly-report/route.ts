// app/api/agent/weekly-report/route.ts
// Generates and emails weekly performance report to company owner
// Zeus calls this every Monday at 8am

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { Resend } from 'resend';
import { resolveCompanyId } from '@/lib/apiAuth';

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resend = new Resend(process.env.RESEND_API_KEY);
  try {
    const callerCompanyId = await resolveCompanyId(req, supabase);
    if (!callerCompanyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { companyId } = await req.json();
    if (!companyId) return NextResponse.json({ error: 'Missing companyId' }, { status: 400 });
    if (companyId !== callerCompanyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString();

    // Get company and owner info
    const { data: company } = await supabase.from('companies').select('*').eq('id', companyId).single();
    const { data: owner } = await supabase.from('profiles').select('*').eq('clerk_id', company?.owner_id).single();

    // Gather stats
    const [convosRes, notesRes, jobsRes, repsRes] = await Promise.all([
      supabase.from('conversations').select('rep_id, summary').eq('company_id', companyId).gte('created_at', weekAgoStr),
      supabase.from('job_notes').select('rep_id, outcome, quote_amount').eq('company_id', companyId).gte('created_at', weekAgoStr),
      supabase.from('jobs').select('id, status, customer_name').eq('company_id', companyId),
      supabase.from('profiles').select('clerk_id, full_name').eq('company_id', companyId).eq('role', 'rep'),
    ]);

    const convos = convosRes.data || [];
    const notes = notesRes.data || [];
    const jobs = jobsRes.data || [];
    const reps = repsRes.data || [];

    const sold = notes.filter((n: any) => n.outcome === 'sold').length;
    const noSale = notes.filter((n: any) => n.outcome === 'no_sale').length;
    const followUp = notes.filter((n: any) => n.outcome === 'follow_up').length;
    const activeJobs = jobs.filter((j: any) => j.status === 'active').length;
    const closedJobs = jobs.filter((j: any) => j.status === 'closed').length;
    const totalRevenue = notes.filter((n: any) => n.outcome === 'sold' && n.quote_amount).map((n: any) => parseFloat((n.quote_amount || '0').replace(/[^0-9.]/g, ''))).reduce((a: number, b: number) => a + b, 0);

    // Rep breakdown
    const repStats = reps.map((r: any) => {
      const repNotes = notes.filter((n: any) => n.rep_id === r.clerk_id);
      const repSold = repNotes.filter((n: any) => n.outcome === 'sold').length;
      const repConvos = convos.filter((c: any) => c.rep_id === r.clerk_id).length;
      return { name: r.full_name || 'Unknown', sold: repSold, sessions: repConvos };
    }).sort((a: any, b: any) => b.sold - a.sold);

    // Generate narrative via Claude
    const narrativeRes = await anthropic.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write a 3-sentence weekly performance summary for a home services company boss. Be direct and specific. No fluff.
Company: ${company?.name}
Deals closed: ${sold}
Close rate: ${sold + noSale > 0 ? Math.round(sold / (sold + noSale) * 100) : 0}%
Revenue logged: $${totalRevenue.toLocaleString()}
Active jobs: ${activeJobs}
Top rep: ${repStats[0]?.name || 'N/A'} with ${repStats[0]?.sold || 0} deals`
      }]
    });

    const narrative = narrativeRes.content[0].type === 'text' ? narrativeRes.content[0].text : 'Good week in the field.';

    // Build email HTML
    const repRows = repStats.map((r: any) => `<tr><td style="padding:8px;border-bottom:1px solid #eee">${r.name}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${r.sold}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${r.sessions}</td></tr>`).join('');

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family:'DM Sans',Arial,sans-serif;background:#f5f5f5;padding:20px">
<div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
  <div style="background:#0b0f14;padding:24px;text-align:center">
    <div style="color:#f07a2e;font-size:1.5rem;font-weight:800">Remy.</div>
    <div style="color:#7a8fa4;font-size:0.85rem;margin-top:4px">Weekly Field Report â€” ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
  </div>
  <div style="padding:28px">
    <div style="background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:24px;color:#333;font-size:0.95rem;line-height:1.6">${narrative}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px">
      <div style="background:#0b0f14;border-radius:8px;padding:16px;text-align:center"><div style="color:#3daf76;font-size:1.8rem;font-weight:800">${sold}</div><div style="color:#7a8fa4;font-size:0.75rem;margin-top:4px">DEALS CLOSED</div></div>
      <div style="background:#0b0f14;border-radius:8px;padding:16px;text-align:center"><div style="color:#f07a2e;font-size:1.8rem;font-weight:800">$${totalRevenue > 0 ? totalRevenue.toLocaleString() : 'â€”'}</div><div style="color:#7a8fa4;font-size:0.75rem;margin-top:4px">REVENUE LOGGED</div></div>
      <div style="background:#0b0f14;border-radius:8px;padding:16px;text-align:center"><div style="color:#4a9fd4;font-size:1.8rem;font-weight:800">${convos.length}</div><div style="color:#7a8fa4;font-size:0.75rem;margin-top:4px">REMY SESSIONS</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="background:#f8f9fa"><th style="padding:8px;text-align:left;font-size:0.75rem;color:#666">REP</th><th style="padding:8px;text-align:center;font-size:0.75rem;color:#666">CLOSED</th><th style="padding:8px;text-align:center;font-size:0.75rem;color:#666">SESSIONS</th></tr></thead>
      <tbody>${repRows || '<tr><td colspan="3" style="padding:12px;text-align:center;color:#999">No rep activity this week</td></tr>'}</tbody>
    </table>
    <div style="text-align:center"><a href="https://remy-nu.vercel.app/boss" style="background:#f07a2e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:0.9rem">View Full Dashboard</a></div>
  </div>
</div>
</body>
</html>`;

    // Send email
    let emailSent = false;
    if (owner?.email) {
      await resend.emails.send({
        from: 'Remy <reports@getremy.dev>',
        to: owner.email,
        subject: `${company?.name} â€” Weekly Field Report`,
        html,
      });
      emailSent = true;
    }

    return NextResponse.json({ 
      success: true, 
      emailSent, 
      stats: { sold, noSale, followUp, activeJobs, closedJobs, totalRevenue, sessions: convos.length, reps: reps.length }
    });
  } catch (error) {
    console.error('Weekly report error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
