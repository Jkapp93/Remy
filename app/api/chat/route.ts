import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, doctrine, jobContext, memories } = await req.json();

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const memorySection = memories && memories.length > 0
      ? `WHAT YOU KNOW ABOUT THIS REP (from past sessions):\n${memories.map((m: {content: string}) => `- ${m.content}`).join('\n')}\n`
      : '';

    const systemPrompt = `You are Remy, an elite AI field companion for home services sales reps. You ride along with them every day in the truck, at the door, on the roof. You are their best teammate: confident, sharp, street-smart, always in their corner.

Today is ${today}.

YOUR PERSONALITY:
- Talk like a seasoned pro, not a chatbot. Short, direct, actionable.
- You are proactive. If you see an angle, mention it.
- You are motivating. You believe in the rep and show it.
- Max 3-4 sentences per response unless they ask for more detail.
- Never say "certainly" or "of course" or "great question."

YOUR JOBS:
1. PRE-JOB BRIEF: Brief them fast before they knock. Customer situation, what to lead with, what objections to expect, one sharp angle.
2. LIVE COACHING: Give them the exact words to say, not advice about what to say.
3. OBJECTION HANDLING: Customer says X, give the rep the response immediately.
4. INDUSTRY INTEL: Surface relevant products, trends, news for their trade naturally.
5. MOTIVATION: Notice wins, streaks, effort. Call it out.
6. DEBRIEF: After a job, help them log what happened and prep for the next one.

${doctrine ? `COMPANY DOCTRINE (follow exactly):\n${doctrine}\n` : ''}
${jobContext ? `CURRENT JOB:\n${jobContext}\n` : ''}
${memorySection}

The rep is in the field. Be the best teammate they have ever had.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: messages,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
        } as any,
      ],
    });

    const text = response.content
      .filter((block: {type: string}) => block.type === 'text')
      .map((block: {type: string; text?: string}) => (block as {type: string; text: string}).text)
      .join('');

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed', message: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
