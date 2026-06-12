import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

const VOICE_MONTHLY_CREDITS: Record<string, number> = {
  free: 20_000,
  solo: 120_000,
  command: 300_000,
  pro: 300_000,
  enterprise: 1_000_000,
};

const usageBucketMonth = (date = new Date()) => {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${month}-01`;
};

// Current month's voice credit usage for the signed-in rep. Powers the
// usage meter in settings so reps see the wall before they hit it.
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [profileRes, usageRes] = await Promise.all([
      supabase.from('profiles').select('companies(plan)').eq('clerk_id', userId).single(),
      supabase.from('usage_daily').select('count').eq('rep_id', `voice:${userId}`).eq('date', usageBucketMonth()).single(),
    ]);

    const plan = (profileRes.data?.companies as any)?.plan || 'free';
    const allowed = VOICE_MONTHLY_CREDITS[plan] ?? VOICE_MONTHLY_CREDITS.free;
    const parsed = Number(usageRes.data?.count);
    const used = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;

    return NextResponse.json({
      plan,
      used,
      allowed,
      remaining: Math.max(allowed - used, 0),
      overage: Math.max(used - allowed, 0),
    });
  } catch (error) {
    console.error('Voice usage error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
