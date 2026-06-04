import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, doctrine, jobContext } = await req.json();

    const systemPrompt = `You are Remy, an AI field companion for home services sales reps. You ride along with reps in the field and help them succeed on every job.

Your personality: confident, concise, street-smart. You talk like a seasoned pro giving advice to their teammate - not like a chatbot.

Keep responses SHORT and actionable. The rep is in the field. 3-4 sentences max unless they ask for more.

${doctrine ? `COMPANY DOCTRINE:\n${doctrine}\n` : ''}
${jobContext ? `CURRENT JOB:\n${jobContext}\n` : ''}

When briefing before a job: customer situation, what to lead with, what to watch for.
When handling objections: give the response directly, do not explain it.
When debriefing: what went well, what to follow up on.`;

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 300,
      system: systemPrompt,
      messages: messages,
    });

    const text = response.content
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { type: string; text?: string }) => (block as { type: string; text: string }).text)
      .join('');

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed to get response', message: 'Something went wrong. Try again.' }, { status: 500 });
  }
}