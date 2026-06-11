import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 6000);
}

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { websiteUrl, companyId, trade } = await req.json();
    if (!websiteUrl || !companyId) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
    // Caller must belong to the company they're seeding doctrine for
    const { data: caller } = await supabase.from('profiles').select('company_id').eq('clerk_id', userId).single();
    if (!caller || caller.company_id !== companyId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`;
    const pageRes = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).catch(() => null);
    if (!pageRes?.ok) return NextResponse.json({ error: 'Could not fetch website' }, { status: 400 });

    const html = await pageRes.text();
    const pageText = stripHtml(html);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `You are extracting sales-relevant information from a company website for a field rep AI assistant.

Trade: ${trade || 'home services'}
Website text: ${pageText}

Write 4-6 short sentences covering: what the company does, their key services/products, any pricing signals or premium positioning, and one sentence on their value proposition. Plain text only, no headers or bullets. Keep it under 300 words. This will be injected into a field rep's AI briefing.`,
      }],
    });

    const doctrine = response.content[0].type === 'text' ? response.content[0].text : '';
    if (!doctrine) return NextResponse.json({ success: false });

    await supabase.from('doctrine').insert({
      content: `[Auto-generated from ${url}]\n${doctrine}`,
      type: 'company',
      active: true,
      company_id: companyId,
    });

    return NextResponse.json({ success: true, doctrine });
  } catch (error) {
    console.error('Onboard doctrine error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
