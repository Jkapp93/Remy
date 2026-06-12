import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const VOICES: Record<string, string> = {
  'f786b574-daa5-4673-aa0c-cbe3e8534c02': 'Remy',
  '30894953-bcce-41fe-892c-15ce19c843ff': 'Parker',
  '692846ad-1a6b-49b8-bfc5-86421fd41a19': 'Thandi',
  'ed9ccfa4-8fa1-40f8-bfb2-cb7d67d2f9cd': 'Ruby',
  'ef191366-f52f-447a-a398-ed8c0f2943a1': 'Archie',
  '34575e71-908f-4ab6-ab54-b08c95d6597d': 'Joey',
};

const DEFAULT_VOICE = 'f786b574-daa5-4673-aa0c-cbe3e8534c02';
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

function getUsageNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'No text' }, { status: 400 });
    }

    const normalizedText = text.trim();
    const requestedUnits = normalizedText.length;
    // The app chunks speech at 240 chars; anything bigger is not our client.
    if (requestedUnits > 600) {
      return NextResponse.json({ error: 'Text too long' }, { status: 400 });
    }

    // Authed users (Clerk session) and the mobile app are tracked separately.
    // Demo traffic keeps a strict per-IP daily cap so the endpoint can't be farmed.
    const { userId } = await auth();
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const isMobile = !!bearer && !!process.env.MOBILE_API_TOKEN && bearer === process.env.MOBILE_API_TOKEN;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let plan = 'free';
    let allowedUnits = VOICE_MONTHLY_CREDITS.free;
    let currentMonthUsage = 0;
    let usageKey: string | null = null;
    let usageMonth = '';
    let nextMonthUsage = 0;
    let usageHeaders: Record<string, string> = {};
    let denyUsage = false;
    let denyReason = '';

    if (userId && !isMobile) {
      usageKey = `voice:${userId}`;
      usageMonth = usageBucketMonth();
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('companies(plan)')
        .eq('clerk_id', userId)
        .single();
      if (profileError) {
        console.error('Voice profile lookup failed:', profileError);
      }

      // Fail OPEN on a failed plan lookup: a DB hiccup must never demote a
      // paying customer to the free cap and silence their voice mid-job.
      const planKnown = !profileError && !!profileData;
      plan = (profileData?.companies as any)?.plan || 'free';
      allowedUnits = VOICE_MONTHLY_CREDITS[plan] ?? VOICE_MONTHLY_CREDITS.free;

      const usageRes = await supabase
        .from('usage_daily')
        .select('count')
        .eq('rep_id', usageKey)
        .eq('date', usageMonth)
        .single();

      currentMonthUsage = getUsageNumber(usageRes.data?.count);
      nextMonthUsage = currentMonthUsage + requestedUnits;
      if (planKnown && plan === 'free' && nextMonthUsage > allowedUnits) {
        denyUsage = true;
        denyReason = `You used your ${plan} monthly voice allowance. Upgrade to continue.`;
      }

      if (planKnown) {
        const overage = Math.max(nextMonthUsage - allowedUnits, 0);
        usageHeaders = {
          'X-Remy-Voice-Plan': plan,
          'X-Remy-Voice-Requested': String(requestedUnits),
          'X-Remy-Voice-Allowed': String(allowedUnits),
          'X-Remy-Voice-Used': String(nextMonthUsage),
          'X-Remy-Voice-Remaining-Included': String(Math.max(allowedUnits - nextMonthUsage, 0)),
          'X-Remy-Voice-Overage': String(Math.max(overage, 0)),
        };
      }

      if (denyUsage) {
        return NextResponse.json(
          { error: denyReason, plan, requestedUnits, allowedUnits, currentMonthUsage },
          { status: 402, headers: usageHeaders }
        );
      }
    } else if (isMobile) {
      // Per-IP daily cap. A single shared bucket would let one heavy user
      // mute the mobile app for everyone until midnight.
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const today = new Date().toISOString().split('T')[0];
      const mobileKey = `voice:mobile:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
      const { data: mobileUsage } = await supabase
        .from('usage_daily')
        .select('count')
        .eq('rep_id', mobileKey)
        .eq('date', today)
        .single();
      const mobileCount = getUsageNumber(mobileUsage?.count);
      if (mobileCount >= 300) {
        return NextResponse.json(
          { error: 'Daily mobile voice limit reached. Resets at midnight.' },
          { status: 429 }
        );
      }
      const { error: incErr } = await supabase.rpc('increment_usage', { p_rep_id: mobileKey, p_date: today });
      if (incErr) console.error('Mobile voice usage increment failed:', incErr);
    } else {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const ipKey = `voice:demo:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
      const today = new Date().toISOString().split('T')[0];
      const { data: usage } = await supabase
        .from('usage_daily')
        .select('count')
        .eq('rep_id', ipKey)
        .eq('date', today)
        .single();
      if ((getUsageNumber(usage?.count) || 0) >= 20) {
        return NextResponse.json({ error: 'Demo voice limit reached for today' }, { status: 429 });
      }
      const { error: incErr } = await supabase.rpc('increment_usage', { p_rep_id: ipKey, p_date: today });
      if (incErr) console.error('Voice demo usage increment failed:', incErr);
    }

    const selectedVoice = (voiceId && VOICES[voiceId]) ? voiceId : DEFAULT_VOICE;

    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Cartesia-Version': '2024-06-10',
        'X-API-Key': process.env.CARTESIA_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript: normalizedText,
        model_id: 'sonic-2',
        voice: { mode: 'id', id: selectedVoice },
        output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Cartesia error:', err);
      return NextResponse.json(
        { error: 'TTS failed', details: err },
        { status: response.status || 500, headers: usageHeaders }
      );
    }

    if (userId && !isMobile && usageKey && usageMonth) {
      // Read-then-upsert can lose an update under concurrency, but the web
      // client serializes TTS requests per session, so per-user races only
      // happen across devices and only undercount slightly. Revisit with an
      // atomic increment RPC if voice billing ever needs to be exact.
      const upsertPayload = { rep_id: usageKey, date: usageMonth, count: nextMonthUsage };
      const { error: usageErr } = await supabase
        .from('usage_daily')
        .upsert(upsertPayload, { onConflict: 'rep_id,date' });
      if (usageErr) console.error('Voice usage update failed:', usageErr);
    }

    const headers = {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      ...usageHeaders,
    };
    return new NextResponse(response.body, { headers });
  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
