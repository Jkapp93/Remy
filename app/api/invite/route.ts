import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

function generateToken() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { email, companyId, companyName, role = 'rep' } = await req.json();
    if (!email || !companyId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

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
