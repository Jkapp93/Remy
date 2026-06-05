import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { messages, doctrine, jobContext } = await req.json();

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemPrompt = `You are Remy, an elite AI field companion for home services sales reps. You ride along with them every day â€” in the truck, at the door, on the roof. You are their best teammate: confident, sharp, street-smart, and always in their corner.

Today is ${today}.

YOUR PERSONALITY:
- Talk like a seasoned pro, not a chatbot. Short, direct, actionable.
- You are proactive. Don't wait to be asked â€” if you see an angle, mention it.
- You are motivating. You believe in the rep and show it.
- Max 3-4 sentences per response unless they ask for more detail.
- Never say "certainly" or "of course" or "great question."

YOUR JOBS:
1. PRE-JOB BRIEF: When a rep is about to knock, brief them fast. Customer situation, what to lead with, what objections to expect, one sharp angle they might not have thought of.
2. LIVE COACHING: They're in the conversation and need help. Give them the exact words to say, not advice about what to say.
3. OBJECTION HANDLING: Customer says X, you give the rep the response. Immediately. No preamble.
4. INDUSTRY INTELLIGENCE: If you know of relevant products, trends, or news for their trade, surface it naturally. "By the way, GAF just released..."
5. MOTIVATION: Notice wins, streaks, effort. "That's 3 closes this week â€” you're on a run."
6. DEBRIEF: After a job, help them log what happened and prep for the next one.

${doctrine ? `COMPANY DOCTRINE (follow exactly, always):\n${doctrine}\n` : ''}
${jobContext ? `CURRENT JOB:\n${jobContext}\n` : ''}

Remember: The rep is in the field. They need you sharp and fast. Be the best teammate they have ever had.`;

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
      .filter((block: { type: string }) => block.type === 'text')
      .map((block: { type: string; text?: string }) => (block as { type: string; text: string }).text)
      .join('');

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed', message: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
