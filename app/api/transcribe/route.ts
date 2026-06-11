import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    // Deepgram costs money per minute — dashboard sessions and the
    // mobile app only.
    const { userId } = await auth();
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const isMobile = !!bearer && !!process.env.MOBILE_API_TOKEN && bearer === process.env.MOBILE_API_TOKEN;
    if (!userId && !isMobile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const formData = await req.formData();
    const audio = formData.get('audio') as File;
    if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 });

    const buffer = await audio.arrayBuffer();

    const response = await fetch('https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': 'audio/m4a',
      },
      body: buffer,
    });

    const data = await response.json();
    const text = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Transcribe error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
