import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getWeather(address: string) {
  try {
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`);
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return null;
    const { lat, lng } = geoData.results[0].geometry.location;
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=imperial`);
    const data = await res.json();
    return `${data.weather[0].description}, ${Math.round(data.main.temp)}F, humidity ${data.main.humidity}%, wind ${Math.round(data.wind.speed)}mph`;
  } catch { return null; }
}

async function getNearbyPlaces(address: string, type: string) {
  try {
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`);
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return null;
    const { lat, lng } = geoData.results[0].geometry.location;
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=${type}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`);
    const data = await res.json();
    return data.results?.slice(0, 4).map((p: any) =>
      `${p.name} (${p.vicinity})${p.rating ? ` ${p.rating} stars` : ''}`
    ).join(', ') || null;
  } catch { return null; }
}

function detectNoteIntent(msg: string): boolean {
  const noteKeywords = ['log this', 'note this', 'remember this', 'save this', 'write that down', 'log it', 'make a note', 'jot that down', 'record this'];
  return noteKeywords.some(k => msg.toLowerCase().includes(k));
}

function detectFollowUpIntent(msg: string): { hasFollowUp: boolean; date?: string } {
  const patterns = [/follow.?up (on |this )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, /call (them |him |her )?(back )?(monday|tuesday|wednesday|thursday|friday|tomorrow|next week)/i, /check back (monday|tuesday|wednesday|thursday|friday|tomorrow|next week)/i];
  for (const p of patterns) {
    const match = msg.match(p);
    if (match) return { hasFollowUp: true, date: match[0] };
  }
  return { hasFollowUp: false };
}

export async function POST(req: NextRequest) {
  try {
    const { messages, doctrine, jobContext, memories, repId, jobId } = await req.json();

    // Rate limiting check
    if (repId) {
      const limitRes = await fetch(`https://remy-nu.vercel.app/api/rate-limit?repId=${repId}`).catch(() => null);
      if (limitRes) {
        const limitData = await limitRes.json();
        if (!limitData.allowed) {
          return NextResponse.json({ 
            message: `You have used all ${limitData.limit} messages for today. Your limit resets at midnight. Upgrade your plan for more daily messages.`,
            rateLimited: true
          });
        }
        // Increment usage
        fetch(`https://remy-nu.vercel.app/api/rate-limit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repId }),
        }).catch(() => {});
      }
    }

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const hour = new Date().getHours();

    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const jobAddress = jobContext ? jobContext.match(/Address: (.+)/)?.[1] : null;
    const hasAddress = jobAddress && jobAddress !== 'Not provided';

    let contextAdditions = '';
    const isNoteRequest = detectNoteIntent(lastMsg);
    const followUp = detectFollowUpIntent(lastMsg);

    if (hasAddress) {
      const needsWeather = lastMsg.includes('weather') || lastMsg.includes('rain') || lastMsg.includes('wind') || lastMsg.includes('hot') || lastMsg.includes('storm') || lastMsg.includes('brief');
      const needsFood = lastMsg.includes('eat') || lastMsg.includes('lunch') || lastMsg.includes('food') || lastMsg.includes('hungry') || lastMsg.includes('restaurant') || lastMsg.includes('grab');
      const needsGas = lastMsg.includes('gas') || lastMsg.includes('fuel');
      const needsHardware = lastMsg.includes('hardware') || lastMsg.includes('home depot') || lastMsg.includes('lowes') || lastMsg.includes('supplies');

      const [weather, food, gas, hardware] = await Promise.all([
        needsWeather ? getWeather(jobAddress) : Promise.resolve(null),
        needsFood ? getNearbyPlaces(jobAddress, 'restaurant') : Promise.resolve(null),
        needsGas ? getNearbyPlaces(jobAddress, 'gas_station') : Promise.resolve(null),
        needsHardware ? getNearbyPlaces(jobAddress, 'hardware_store') : Promise.resolve(null),
      ]);

      if (weather) contextAdditions += `\nWEATHER AT JOB: ${weather}\n`;
      if (food) contextAdditions += `\nNEARBY FOOD: ${food}\n`;
      if (gas) contextAdditions += `\nNEARBY GAS: ${gas}\n`;
      if (hardware) contextAdditions += `\nNEARBY HARDWARE: ${hardware}\n`;
    }

    if (isNoteRequest) {
      contextAdditions += `\nThe rep wants to log a note. After acknowledging their note, confirm what you saved and remind them you will keep it on file.\n`;
    }

    if (followUp.hasFollowUp) {
      contextAdditions += `\nThe rep mentioned a follow-up: ${followUp.date}. Acknowledge it and confirm you have noted it.\n`;
    }

    const memorySection = memories && memories.length > 0
      ? `WHAT YOU KNOW ABOUT THIS REP:\n${memories.map((m: {content: string}) => `- ${m.content}`).join('\n')}\n`
      : '';

    const systemPrompt = `You are Remy, an elite AI field co-pilot for home services sales reps. Sharp, direct, always in their corner.

Today is ${today}. Time: ${timeNow}.${hour >= 10 && hour <= 14 ? ' Lunch window.' : ''}

CRITICAL RULES:
- Never use markdown. No headers, bullets, bold, dashes. Plain sentences only.
- Pre-job brief: 3 sentences max. One angle, one objection to expect, one opener.
- All other responses: 2-3 sentences max unless asked for more.
- Never say certainly, of course, great question, absolutely.
- Never start a response with I.
- Talk like a trusted teammate in the truck with them.

NOTE TAKING:
- When rep says log this, note this, remember this, save this â€” confirm you logged it and summarize what you captured.
- When they mention a follow-up date â€” confirm you noted it.
- When they describe what happened at a job â€” summarize it back in one sentence and confirm it is saved.

FIELD INTEL:
- Surface weather, food, supplies naturally when relevant. Never list robotically.
- If rep sounds tired or frustrated â€” acknowledge it briefly, then refocus.

WHAT YOU DO:
- Brief reps before they knock. Fast, sharp, specific.
- Give exact words to say, not advice about what to say.
- Handle objections with ready responses.
- Log notes when asked. No forms, no typing, just talk.
- Remind reps of follow-ups they mentioned.
- Motivate without being cheesy.

${doctrine ? `COMPANY DOCTRINE:\n${doctrine}\n` : ''}
${jobContext ? `CURRENT JOB:\n${jobContext}\n` : ''}
${memorySection}
${contextAdditions}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      system: systemPrompt,
      messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
    });

    const text = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    // If note intent detected, save the note in background
    if (isNoteRequest && repId) {
      const rawNote = messages[messages.length - 1]?.content || '';
      fetch(`https://remy-nu.vercel.app/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repId, jobId, rawNote, jobName: jobContext?.split('\n')[0] }),
      }).catch(() => {});
    }

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed', message: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
