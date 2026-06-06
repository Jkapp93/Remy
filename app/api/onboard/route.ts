import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { clerkId, companyName, fullName, email, inviteToken } = await req.json();

    if (!clerkId) return NextResponse.json({ error: 'No clerkId' }, { status: 400 });

    // Check if joining via invite
    if (inviteToken) {
      const { data: invite } = await supabase
        .from('invites')
        .select('*, companies(*)')
        .eq('token', inviteToken.trim())
        .eq('accepted', false)
        .single();

      if (!invite) return NextResponse.json({ error: 'Invalid or expired invite code.' }, { status: 400 });

      await supabase.from('profiles').upsert({
        clerk_id: clerkId,
        company_id: invite.company_id,
        role: invite.role,
        full_name: fullName || '',
        email: email || '',
      });

      await supabase.from('invites').update({ accepted: true }).eq('id', invite.id);

      return NextResponse.json({ success: true, role: invite.role, redirect: '/dashboard/voice' });
    }

    // Creating new company
    if (!companyName) return NextResponse.json({ error: 'No company name' }, { status: 400 });

    const { data: company, error: companyErr } = await supabase
      .from('companies')
      .insert({ name: companyName, owner_id: clerkId, plan: 'solo' })
      .select()
      .single();

    if (companyErr || !company) {
      console.error('Company error:', companyErr);
      return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
    }

    await supabase.from('profiles').upsert({
      clerk_id: clerkId,
      company_id: company.id,
      role: 'owner',
      full_name: fullName || '',
      email: email || '',
    });

    return NextResponse.json({ success: true, role: 'owner', redirect: '/boss' });
  } catch (error) {
    console.error('Onboard error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
