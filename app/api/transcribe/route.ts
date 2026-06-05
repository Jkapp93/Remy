import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
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
