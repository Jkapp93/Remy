import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, doctrine, jobContext, repMemory } = await req.json();

    const systemPrompt = `You are Remy, an AI field companion for home services sales reps. You ride along with reps in the field and help them succeed on every job.

Your personality: confident, concise, street-smart. You've seen thousands of jobs. You know what works. You talk like a seasoned pro giving advice to their teammate — not like a chatbot.

Keep responses SHORT and actionable. The rep is in the field. They don't have time for paragraphs.

${doctrine ? `COMPANY DOCTRINE (follow this exactly):\n${doctrine}\n` : ''}
${jobContext ? `CURRENT JOB:\n${jobContext}\n` : ''}
${repMemory ? `WHAT YOU KNOW ABOUT THIS REP:\n${repMemory}\n` : ''}

When the rep pulls up to a job, brief them fast: customer situation, what to lead with, what to watch for.
When they face an objection, give them the response — don't explain it, just give it to them.
When the job is done, debrief: what went well, what to follow up on.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: messages,
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed to get response' }, { status: 500 });
  }
}
