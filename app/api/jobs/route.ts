import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveCompanyId } from '@/lib/apiAuth';

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Every method is company-scoped via resolveCompanyId. Unidentified
// callers get empty results or 401 — never cross-company data.

export async function GET(req: NextRequest) {
  try {
    const supabase = db();
    const companyId = await resolveCompanyId(req, supabase);
    if (!companyId) return NextResponse.json({ jobs: [] });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status'); // 'active' | 'all'

    let query = supabase.from('jobs').select('*').eq('company_id', companyId).order('created_at', { ascending: false });
    if (status !== 'all') query = query.eq('status', 'active');

    const { data } = await query;
    return NextResponse.json({ jobs: data || [] });
  } catch (error) {
    console.error('Jobs error:', error);
    return NextResponse.json({ jobs: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = db();
    const companyId = await resolveCompanyId(req, supabase);
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { customer_name, address, notes, job_type } = body;
    if (!customer_name?.trim()) return NextResponse.json({ error: 'customer_name required' }, { status: 400 });
    const { data, error } = await supabase.from('jobs').insert({
      customer_name, address: address || '', notes: notes || '',
      status: 'active', job_type: job_type || 'other',
      company_id: companyId,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job: data });
  } catch (error) {
    console.error('Jobs POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

const PATCHABLE_FIELDS = ['status', 'notes', 'address', 'customer_name', 'job_type', 'stage', 'deal_value'];

export async function PATCH(req: NextRequest) {
  try {
    const supabase = db();
    const companyId = await resolveCompanyId(req, supabase);
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const updates: Record<string, unknown> = {};
    for (const k of PATCHABLE_FIELDS) if (k in fields) updates[k] = fields[k];
    if (!Object.keys(updates).length) return NextResponse.json({ error: 'no valid fields' }, { status: 400 });

    const { data, error } = await supabase.from('jobs').update(updates).eq('id', id).eq('company_id', companyId).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job: data });
  } catch (error) {
    console.error('Jobs PATCH error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = db();
    const companyId = await resolveCompanyId(req, supabase);
    if (!companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('jobs').delete().eq('id', id).eq('company_id', companyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Jobs DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
