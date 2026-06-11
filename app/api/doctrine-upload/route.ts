import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const text = new TextDecoder('utf-8').decode(buffer);

    // Clean up the text
    const cleaned = text
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s{3,}/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 50000); // limit to 50k chars

    return NextResponse.json({ content: cleaned });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to process file' }, { status: 500 });
  }
}
