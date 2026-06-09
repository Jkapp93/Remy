import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const LIMITS: Record<string, number> = {
  free: 20,
  solo: 150,
  command: 500,
  enterprise: 99999,
};

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(req.url);
  const repId = searchParams.get('repId');
  if (!repId) return NextResponse.json({ allowed: false, remaining: 0 });

  const today = new Date().toISOString().split('T')[0];

  // Get profile and plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id, companies(plan)')
    .eq('clerk_id', repId)
    .single();

  const plan = (profile?.companies as any)?.plan || 'free';
  const limit = LIMITS[plan] || LIMITS.free;

  // Get today's usage
  const { data: usage } = await supabase
    .from('usage_daily')
    .select('count')
    .eq('rep_id', repId)
    .eq('date', today)
    .single();

  const count = usage?.count || 0;
  const remaining = Math.max(0, limit - count);

  return NextResponse.json({ allowed: count < limit, remaining, limit, count });
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { repId } = await req.json();
  if (!repId) return NextResponse.json({ success: false });

  const today = new Date().toISOString().split('T')[0];

  const { data: existing } = await supabase
    .from('usage_daily')
    .select('id, count')
    .eq('rep_id', repId)
    .eq('date', today)
    .single();

  if (existing) {
    await supabase
      .from('usage_daily')
      .update({ count: existing.count + 1 })
      .eq('id', existing.id);
  } else {
    await supabase
      .from('usage_daily')
      .insert({ rep_id: repId, date: today, count: 1 });
  }

  return NextResponse.json({ success: true });
}
