import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { resolveCompanyId } from '@/lib/apiAuth';

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const resolvedCompanyId = await resolveCompanyId(req, supabase);
    if (!resolvedCompanyId) return NextResponse.json({ items: [] });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const includeInactive = searchParams.get('includeInactive') === '1';

    let query = supabase.from('doctrine').select('id, content, type, active, created_at').eq('company_id', resolvedCompanyId).order('created_at', { ascending: false }).limit(50);
    if (!includeInactive) query = query.eq('active', true);
    if (type) query = query.eq('type', type);

    const { data } = await query;
    return NextResponse.json({ items: data || [] });
  } catch (error) {
    console.error('Doctrine GET error:', error);
    return NextResponse.json({ items: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await req.json();
    const { content, type, company_id } = body;
    if (!content?.trim()) return NextResponse.json({ error: 'content required' }, { status: 400 });
    if (content.length > 5000) return NextResponse.json({ error: 'Content too long' }, { status: 400 });
    // Verify the user belongs to this company
    if (company_id) {
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('clerk_id', userId).single();
      if (!profile || profile.company_id !== company_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data, error } = await supabase.from('doctrine').insert({
      content, type: type || 'text', active: true, company_id: company_id || null,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (error) {
    console.error('Doctrine POST error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    // Verify the doctrine entry belongs to user's company
    const { data: profile } = await supabase.from('profiles').select('company_id').eq('clerk_id', userId).single();
    const { data: doc } = await supabase.from('doctrine').select('company_id').eq('id', id).single();
    if (!profile || !doc || profile.company_id !== doc.company_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { error } = await supabase.from('doctrine').update(fields).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Doctrine PATCH error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
