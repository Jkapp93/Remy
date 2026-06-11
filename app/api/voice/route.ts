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

export async function POST(req: NextRequest) {
  try {
    const { text, voiceId } = await req.json();
    if (!text) return NextResponse.json({ error: 'No text' }, { status: 400 });

    // Authed users (Clerk session) and the mobile app are unrestricted.
    // Demo traffic gets a per-IP daily cap + text length cap so the
    // endpoint can't be farmed as a free Cartesia proxy.
    const { userId } = await auth();
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const isMobile = !!bearer && !!process.env.MOBILE_API_TOKEN && bearer === process.env.MOBILE_API_TOKEN;
    if (!userId && !isMobile) {
      if (typeof text !== 'string' || text.length > 600) {
        return NextResponse.json({ error: 'Text too long for demo' }, { status: 400 });
      }
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const ipKey = `voicedemo:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
      const today = new Date().toISOString().split('T')[0];
      const { data: usage } = await supabase.from('usage_daily').select('count').eq('rep_id', ipKey).eq('date', today).single();
      if ((usage?.count || 0) >= 20) {
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
        transcript: text,
        model_id: 'sonic-2',
        voice: { mode: 'id', id: selectedVoice },
        output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
        stream: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Cartesia error:', err);
      return NextResponse.json({ error: 'TTS failed', details: err }, { status: 500 });
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
