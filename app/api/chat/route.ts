import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getWeather(address: string) {
  try {
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return null;
    const { lat, lng } = geoData.results[0].geometry.location;
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=imperial`
    );
    const data = await res.json();
    return `${data.weather[0].description}, ${Math.round(data.main.temp)}F, humidity ${data.main.humidity}%, wind ${Math.round(data.wind.speed)}mph`;
  } catch { return null; }
}

async function getNearbyPlaces(address: string, type: string) {
  try {
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return null;
    const { lat, lng } = geoData.results[0].geometry.location;
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=${type}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
    );
    const data = await res.json();
    return data.results?.slice(0, 4).map((p: any) =>
      `${p.name} (${p.vicinity})${p.rating ? ` ${p.rating} stars` : ''}`
    ).join(', ') || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, doctrine, jobContext, memories } = await req.json();

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const hour = new Date().getHours();

    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    const jobAddress = jobContext ? jobContext.match(/Address: (.+)/)?.[1] : null;
    const hasAddress = jobAddress && jobAddress !== 'Not provided';

    // Build context additions based on what rep is asking
    let contextAdditions = '';

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

    // Memory context â€” what Remy knows about this rep's patterns
    const memorySection = memories && memories.length > 0
      ? `WHAT YOU KNOW ABOUT THIS REP:\n${memories.map((m: {content: string}) => `- ${m.content}`).join('\n')}\nUse this to personalize your style and anticipate their needs.\n`
      : '';

    const systemPrompt = `You are Remy, an elite AI field companion riding along with home services sales reps. You are sharp, direct, and always in their corner.

Today is ${today}. Time: ${timeNow}.${hour >= 10 && hour <= 14 ? ' It is lunch time.' : ''}

CRITICAL RULES:
- Never use markdown. No headers, bullets, bold, dashes. Plain sentences only.
- Pre-job brief: 3 sentences max. Lead with one sharp angle, one objection to expect, one opener line.
- All other responses: 2-3 sentences max unless asked for more.
- Never say certainly, of course, great question, absolutely.
- Talk like a trusted teammate not a chatbot.
- If you know weather or nearby places, work them in naturally. Do not list them robotically.
- Never start a response with "I".

WHAT YOU DO:
- Brief reps before they knock. Fast, sharp, specific.
- Give exact words to say, not advice about what to say.
- Handle objections in real time with ready responses.
- Surface field intel naturally: weather, food, supplies, drive time.
- Motivate without being cheesy. Notice wins and call them out.
- Debrief after jobs and prep for the next one.

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

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed', message: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
