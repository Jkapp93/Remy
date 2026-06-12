import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.WEBHOOK_ALLOWED_ORIGIN,
].filter(Boolean) as string[];

const corsHeadersFor = (req: NextRequest) => {
  const origin = req.headers.get('origin');
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0] || '';
  const headers = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  } as Record<string, string>;

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
  }

  return headers;
};

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeadersFor(req) });
}

// Generic CRM webhook — accepts jobs from JobNimbus, AccuLynx, ServiceTitan, etc.
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const authHeader = req.headers.get('authorization');
    const webhookSecret = process.env.WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('WEBHOOK_SECRET is not configured. Rejecting webhook request.');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500, headers: corsHeadersFor(req) });
    }

    if (authHeader !== `Bearer ${webhookSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeadersFor(req) });
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
        return NextResponse.json({ success: true, action: 'updated' }, { headers: corsHeadersFor(req) });
      }
    }

    await supabase.from('jobs').insert(job);
    return NextResponse.json({ success: true, action: 'created' }, { headers: corsHeadersFor(req) });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500, headers: corsHeadersFor(req) });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Remy webhook active', version: '1.0' }, { headers: corsHeadersFor(req) });
}
