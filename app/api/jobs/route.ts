import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const clerkId = searchParams.get('clerkId');
    const status = searchParams.get('status'); // 'active' | 'all'

    let resolvedCompanyId = companyId;
    if (!resolvedCompanyId && clerkId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('clerk_id', clerkId)
        .single();
      resolvedCompanyId = profile?.company_id || null;
    }

    let query = supabase.from('jobs').select('*').order('created_at', { ascending: false });
    if (resolvedCompanyId) query = query.eq('company_id', resolvedCompanyId);
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
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await req.json();
    const { customer_name, address, notes, job_type, company_id } = body;
    if (!customer_name?.trim()) return NextResponse.json({ error: 'customer_name required' }, { status: 400 });
    const { data, error } = await supabase.from('jobs').insert({
      customer_name, address: address || '', notes: notes || '',
      status: 'active', job_type: job_type || 'other',
      company_id: company_id || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job: data });
  } catch (error) {
    console.error('Jobs POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { data, error } = await supabase.from('jobs').update(fields).eq('id', id).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job: data });
  } catch (error) {
    console.error('Jobs PATCH error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Jobs DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
