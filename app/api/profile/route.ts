import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(req.url);
  const clerkId = searchParams.get('clerkId');
  if (!clerkId) return NextResponse.json({ profile: null });
  const { data } = await supabase
    .from('profiles')
    .select('*, companies(*)')
    .eq('clerk_id', clerkId)
    .single();
  return NextResponse.json({ profile: data });
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const body = await req.json();
  const { clerkId, voiceId } = body;
  if (!clerkId) return NextResponse.json({ error: 'No clerkId' }, { status: 400 });
  const { data } = await supabase
    .from('profiles')
    .upsert({ clerk_id: clerkId, voice_id: voiceId })
    .select()
    .single();
  return NextResponse.json({ profile: data });
}

export async function PATCH(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const body = await req.json();
  const { clerkId, ...fields } = body;
  if (!clerkId) return NextResponse.json({ error: 'No clerkId' }, { status: 400 });
  const { data } = await supabase
    .from('profiles')
    .update(fields)
    .eq('clerk_id', clerkId)
    .select()
    .single();
  return NextResponse.json({ profile: data });
}
