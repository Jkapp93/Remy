import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  const { searchParams } = new URL(req.url);
  const clerkId = searchParams.get('clerkId');
  // Only your own profile — clerkId param kept for caller compatibility
  if (!userId || (clerkId && clerkId !== userId)) return NextResponse.json({ profile: null });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('clerk_id', userId)
    .single();
  return NextResponse.json({ profile: data });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const body = await req.json();
  const { voiceId } = body;
  const { data } = await supabase
    .from('profiles')
    .upsert({ clerk_id: userId, voice_id: voiceId })
    .select()
    .single();
  return NextResponse.json({ profile: data });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const body = await req.json();
  const { clerkId, ...fields } = body;
  if (!clerkId) return NextResponse.json({ error: 'No clerkId' }, { status: 400 });
  if (!userId || userId !== clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data } = await supabase
    .from('profiles')
    .update(fields)
    .eq('clerk_id', clerkId)
    .select()
    .single();
  return NextResponse.json({ profile: data });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { clerkId, agentName, crmWebhookUrl } = await req.json();
  if (!clerkId) return NextResponse.json({ error: 'Missing clerkId' }, { status: 400 });
  if (!userId || userId !== clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('company_id').eq('clerk_id', clerkId).single();
  if (!profile?.company_id) return NextResponse.json({ error: 'No company' }, { status: 404 });

  const updates: Record<string, string> = {};
  if (agentName) updates.agent_name = agentName;
  if (crmWebhookUrl !== undefined) updates.crm_webhook_url = crmWebhookUrl;

  if (Object.keys(updates).length > 0) {
    await supabase.from('companies').update(updates).eq('id', profile.company_id);
  }
  return NextResponse.json({ success: true });
}
