import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data } = await supabase
      .from('doctrine')
      .select('content')
      .eq('active', true);

    const doctrine = data ? data.map((d: {content: string}) => d.content).join('\n') : '';
    return NextResponse.json({ doctrine });
  } catch (error) {
    console.error('Doctrine error:', error);
    return NextResponse.json({ doctrine: '' });
  }
}
