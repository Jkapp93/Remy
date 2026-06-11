import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { auth } from '@clerk/nextjs/server';
import { randomBytes } from 'node:crypto';

function generateToken() {
  // 8 chars from a CSPRNG, unambiguous alphabet
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(randomBytes(8)).map(b => alphabet[b % alphabet.length]).join('');
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { email, companyId, companyName, role = 'rep' } = await req.json();
    if (!email || !companyId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    // Only an owner of this company can invite to it
    const { data: caller } = await supabase.from('profiles').select('company_id, role').eq('clerk_id', userId).single();
    if (!caller || caller.company_id !== companyId || caller.role !== 'owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = generateToken();

    await supabase.from('invites').insert({
      company_id: companyId,
      email,
      role,
      token,
    });

    await resend.emails.send({
      from: 'Remy <onboarding@resend.dev>',
      to: email,
      subject: `You've been invited to join ${companyName} on Remy`,
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:24px">
          <h2 style="color:#f07a2e">You're invited to Remy.</h2>
          <p>Your boss has invited you to join <strong>${companyName}</strong> on Remy â€” the AI field companion for home services reps.</p>
          <p>Your invite code: <strong style="font-size:1.4rem;letter-spacing:0.1em">${token}</strong></p>
          <p>Go to <a href="${process.env.NEXT_PUBLIC_APP_URL}/onboard">remy-nu.vercel.app/onboard</a>, select "I am a field rep" and enter your code.</p>
          <p style="color:#999;font-size:0.85rem">This invite expires in 7 days.</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, token });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
