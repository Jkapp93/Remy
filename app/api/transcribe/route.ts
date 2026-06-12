import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const deepgramKey = process.env.DEEPGRAM_API_KEY;
    if (!deepgramKey) {
      console.error('Transcribe API config missing Deepgram key.');
      return NextResponse.json({ error: 'Speech service unavailable' }, { status: 503 });
    }

    // Deepgram costs money per minute — dashboard sessions and the
    // mobile app only.
    const { userId } = await auth();
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const mobileApiToken = process.env.MOBILE_API_TOKEN;
    const isMobile = !!bearer && !!mobileApiToken && bearer === mobileApiToken;
    if (!userId && !isMobile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const audio = formData.get('audio') as File;
    if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 });

    const buffer = await audio.arrayBuffer();

    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${deepgramKey}`,
        'Content-Type': 'audio/m4a',
      },
      body: buffer,
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error('Deepgram error:', response.status, detail);
      return NextResponse.json(
        { error: 'Transcribe failed', details: detail },
        { status: response.status >= 500 ? 503 : 429 }
      );
    }

    const data = await response.json();
    const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Transcribe error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
