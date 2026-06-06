import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function getWeather(lat: number, lng: number) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=imperial`
    );
    const data = await res.json();
    return `Weather: ${data.weather[0].description}, ${Math.round(data.main.temp)}Â°F, humidity ${data.main.humidity}%, wind ${Math.round(data.wind.speed)}mph`;
  } catch { return null; }
}

async function getWeatherByAddress(address: string) {
  try {
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
    );
    const geoData = await geoRes.json();
    if (geoData.results?.[0]) {
      const { lat, lng } = geoData.results[0].geometry.location;
      return await getWeather(lat, lng);
    }
  } catch { return null; }
  return null;
}

async function getNearbyPlaces(address: string, type: string) {
  try {
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return null;
    const { lat, lng } = geoData.results[0].geometry.location;
    const placesRes = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=${type}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`
    );
    const placesData = await placesRes.json();
    const places = placesData.results?.slice(0, 5).map((p: any) =>
      `${p.name} (${p.vicinity}) - ${p.rating ? `${p.rating}â˜…` : 'no rating'}`
    ).join('\n');
    return places || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, doctrine, jobContext, memories } = await req.json();

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    const memorySection = memories && memories.length > 0
      ? `WHAT YOU KNOW ABOUT THIS REP (from past sessions):\n${memories.map((m: {content: string}) => `- ${m.content}`).join('\n')}\n`
      : '';

    // Check if the last message is asking about weather or places
    const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || '';
    let contextAdditions = '';

    const jobAddress = jobContext ? jobContext.match(/Address: (.+)/)?.[1] : null;

    if (jobAddress && jobAddress !== 'Not provided') {
      if (lastMsg.includes('weather') || lastMsg.includes('rain') || lastMsg.includes('wind') || lastMsg.includes('storm')) {
        const weather = await getWeatherByAddress(jobAddress);
        if (weather) contextAdditions += `\nCURRENT WEATHER AT JOB ADDRESS: ${weather}\n`;
      }

      if (lastMsg.includes('eat') || lastMsg.includes('lunch') || lastMsg.includes('food') || lastMsg.includes('restaurant') || lastMsg.includes('hungry')) {
        const places = await getNearbyPlaces(jobAddress, 'restaurant');
        if (places) contextAdditions += `\nNEARBY RESTAURANTS:\n${places}\n`;
      }

      if (lastMsg.includes('gas') || lastMsg.includes('fuel')) {
        const places = await getNearbyPlaces(jobAddress, 'gas_station');
        if (places) contextAdditions += `\nNEARBY GAS STATIONS:\n${places}\n`;
      }

      if (lastMsg.includes('hardware') || lastMsg.includes('home depot') || lastMsg.includes('supplies') || lastMsg.includes('lowes')) {
        const places = await getNearbyPlaces(jobAddress, 'hardware_store');
        if (places) contextAdditions += `\nNEARBY HARDWARE STORES:\n${places}\n`;
      }

      if (lastMsg.includes('roofing supply') || lastMsg.includes('abc supply') || lastMsg.includes('beacon')) {
        const places = await getNearbyPlaces(jobAddress, 'roofing_contractor');
        if (places) contextAdditions += `\nNEARBY ROOFING SUPPLIERS:\n${places}\n`;
      }
    }

    const systemPrompt = `You are Remy, an elite AI field companion for home services sales reps. You ride along with them every day in the truck, at the door, on the roof. You are their best teammate: confident, sharp, street-smart, always in their corner.

Today is ${today}. Current time: ${timeNow}.

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
4. WEATHER & FIELD INTEL: Surface weather conditions, nearby places, drive times naturally.
5. MOTIVATION: Notice wins, streaks, effort. Call it out.
6. DEBRIEF: After a job, help them log what happened and prep for the next one.

${doctrine ? `COMPANY DOCTRINE (follow exactly):\n${doctrine}\n` : ''}
${jobContext ? `CURRENT JOB:\n${jobContext}\n` : ''}
${memorySection}
${contextAdditions}

The rep is in the field. Be the best teammate they have ever had.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: systemPrompt,
      messages: messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search' } as any],
    });

    const text = response.content
      .filter((block: {type: string}) => block.type === 'text')
      .map((block: {type: string; text?: string}) => (block as any).text)
      .join('');

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed', message: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
