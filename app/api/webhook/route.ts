import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Generic CRM webhook â€” accepts jobs from JobNimbus, AccuLynx, ServiceTitan, etc.
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const authHeader = req.headers.get('authorization');
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Normalize job data from any CRM format
    const job = {
      customer_name: body.customer_name || body.customerName || body.contact_name || body.name || 'Unknown',
      address: body.address || body.street || body.location || '',
      notes: body.notes || body.description || body.job_type || '',
      status: 'active',
      crm_id: body.id || body.job_id || body.jobId || null,
      crm_source: body.source || 'webhook',
    };

    // Check if job already exists by crm_id
    if (job.crm_id) {
      const { data: existing } = await supabase
        .from('jobs')
        .select('id')
        .eq('crm_id', job.crm_id)
        .single();

      if (existing) {
        await supabase.from('jobs').update(job).eq('crm_id', job.crm_id);
        return NextResponse.json({ success: true, action: 'updated' });
      }
    }

    await supabase.from('jobs').insert(job);
    return NextResponse.json({ success: true, action: 'created' });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// GET endpoint to verify webhook is live
export async function GET() {
  return NextResponse.json({ status: 'Remy webhook active', version: '1.0' });
}
