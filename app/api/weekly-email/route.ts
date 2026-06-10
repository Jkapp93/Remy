import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function GET(req: NextRequest) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    // Get all companies
    const { data: companies } = await supabase.from('companies').select('*, profiles(*)');
    if (!companies) return NextResponse.json({ sent: 0 });

    let sent = 0;
    for (const company of companies) {
      // Get owner email
      const owner = (company.profiles as any[])?.find((p: any) => p.role === 'owner');
      if (!owner?.email) continue;

      // Get this week's stats
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const [jobData, convData] = await Promise.all([
        supabase.from('jobs').select('*').eq('company_id', company.id).gte('created_at', weekAgo),
        supabase.from('conversations').select('*').eq('company_id', company.id).gte('created_at', weekAgo),
      ]);

      const jobs = jobData.data || [];
      const convs = convData.data || [];
      const activeJobs = jobs.filter((j: any) => j.status === 'active').length;
      const closedJobs = jobs.filter((j: any) => j.status === 'closed').length;

      const recentConvSummaries = convs.slice(0, 5).map((c: any) => 
        `<li style="margin-bottom:8px;color:#555">${c.summary || 'Conversation logged'}</li>`
      ).join('');

      await resend.emails.send({
        from: 'Remy <onboarding@resend.dev>',
        to: owner.email,
        subject: `Remy Weekly Report - ${company.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f9f9f9">
            <div style="background:#0b0f14;padding:24px;border-radius:12px;margin-bottom:20px">
              <h1 style="color:#f07a2e;margin:0;font-size:1.4rem">Remy<span style="color:#fff">.</span></h1>
              <p style="color:#7a8fa4;margin:8px 0 0">Weekly Field Report</p>
            </div>
            <div style="background:#fff;padding:24px;border-radius:12px;margin-bottom:16px">
              <h2 style="color:#111;margin:0 0 16px;font-size:1.1rem">${company.name} â€” This Week</h2>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
                <div style="background:#f5f5f5;padding:16px;border-radius:8px;text-align:center">
                  <div style="font-size:2rem;font-weight:800;color:#f07a2e">${activeJobs}</div>
                  <div style="font-size:0.8rem;color:#999">Active Jobs</div>
                </div>
                <div style="background:#f5f5f5;padding:16px;border-radius:8px;text-align:center">
                  <div style="font-size:2rem;font-weight:800;color:#3daf76">${closedJobs}</div>
                  <div style="font-size:0.8rem;color:#999">Closed Jobs</div>
                </div>
                <div style="background:#f5f5f5;padding:16px;border-radius:8px;text-align:center">
                  <div style="font-size:2rem;font-weight:800;color:#4a9fd4">${convs.length}</div>
                  <div style="font-size:0.8rem;color:#999">Remy Sessions</div>
                </div>
              </div>
              ${recentConvSummaries ? `<h3 style="color:#111;font-size:0.95rem;margin:0 0 12px">Recent Field Activity</h3><ul style="padding-left:20px;margin:0">${recentConvSummaries}</ul>` : '<p style="color:#999;font-size:0.9rem">No conversations logged this week.</p>'}
            </div>
            <div style="text-align:center;padding:16px">
              <a href="https://remy-nu.vercel.app/boss" style="background:#f07a2e;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">View Command Center</a>
            </div>
            <p style="color:#999;font-size:0.75rem;text-align:center;margin-top:16px">Remy â€” AI Field Companion for Home Services</p>
          </div>
        `,
      });
      sent++;
    }
    return NextResponse.json({ sent });
  } catch (error) {
    console.error('Weekly email error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
