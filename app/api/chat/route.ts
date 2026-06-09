import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';

const PLAN_LIMITS: Record<string, number> = { free: 20, solo: 150, command: 500, enterprise: 99999 };

async function getWeather(address: string) {
  try {
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`);
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return null;
    const { lat, lng } = geoData.results[0].geometry.location;
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=imperial`);
    const data = await res.json();
    const conditions = data.weather[0].description.toLowerCase();
    const isStorm = conditions.includes('storm') || conditions.includes('thunder') || data.wind.speed > 35;
    return { summary: `${data.weather[0].description}, ${Math.round(data.main.temp)}F, wind ${Math.round(data.wind.speed)}mph`, isStorm };
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
    return data.results?.slice(0, 4).map((p: any) => `${p.name} (${p.vicinity})${p.rating ? ` ${p.rating} stars` : ''}`).join(', ') || null;
  } catch { return null; }
}

function detectNoteIntent(msg: string): boolean {
  return ['log this', 'note this', 'remember this', 'save this', 'write that down', 'log it', 'make a note', 'record this'].some(k => msg.toLowerCase().includes(k));
}

function detectFollowUp(msg: string): string | null {
  const patterns = [
    /follow.?up (on |this )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)/i,
    /call (them|him|her)? ?(back)? ?(monday|tuesday|wednesday|thursday|friday|tomorrow|next week)/i,
    /check back (monday|tuesday|wednesday|thursday|friday|tomorrow|next week)/i,
  ];
  for (const p of patterns) { const m = msg.match(p); if (m) return m[0]; }
  return null;
}

function detectJobOutcome(msg: string): string | null {
  const lower = msg.toLowerCase();
  if (/(they signed|signed the deal|closed it|got the job|sold it|they said yes|closed the deal|got the contract)/.test(lower)) return 'sold';
  if (/(they passed|no sale|not interested|lost it|they said no|not moving forward|passed on it)/.test(lower)) return 'no_sale';
  if (/(follow up|they want to think|need to think about it|get back to me)/.test(lower)) return 'follow_up';
  return null;
}

function detectFinancingNeed(msg: string): boolean {
  return /(too expensive|cant afford|price is high|out of budget|financing|payment plan|monthly payments)/.test(msg.toLowerCase());
}

export async function POST(req: NextRequest) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { messages, doctrine, jobContext, memories, repId, jobId, systemOverride, isMorningBrief } = await req.json();

    // Auth: if repId is provided, the session must belong to that rep
    if (repId) {
      const { userId } = await auth();
      if (!userId || userId !== repId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Cap history to keep tokens lean in long sessions
    const trimmedMessages = Array.isArray(messages) ? messages.slice(-12) : messages;

    // Inline rate limit — no HTTP self-call, no extra latency
    let companyId: string | null = null;
    let repName: string | null = null;
    if (repId) {
      const today = new Date().toISOString().split('T')[0];
      const [profileRes, usageRes] = await Promise.all([
        supabase.from('profiles').select('company_id, full_name, companies(plan)').eq('clerk_id', repId).single(),
        supabase.from('usage_daily').select('id, count').eq('rep_id', repId).eq('date', today).single(),
      ]);
      companyId = profileRes.data?.company_id || null;
      repName = profileRes.data?.full_name || null;
      const plan = (profileRes.data?.companies as any)?.plan || 'free';
      const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
      const count = usageRes.data?.count || 0;
      if (count >= limit) {
        return NextResponse.json({ message: `You've used all ${limit} messages for today. Resets at midnight.`, rateLimited: true });
      }
      // Increment usage — fire and forget
      if (usageRes.data) {
        void supabase.from('usage_daily').update({ count: count + 1 }).eq('id', usageRes.data.id);
      } else {
        void supabase.from('usage_daily').insert({ rep_id: repId, date: today, count: 1 });
      }
    }

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const hour = new Date().getHours();
    const lastMsg = messages[messages.length - 1]?.content || '';
    const lastMsgLower = lastMsg.toLowerCase();

    const isNoteRequest = detectNoteIntent(lastMsgLower);
    const followUpDate = detectFollowUp(lastMsgLower);
    const jobOutcome = detectJobOutcome(lastMsgLower);
    const needsFinancing = detectFinancingNeed(lastMsgLower);

    const jobAddress = jobContext ? jobContext.match(/Address: (.+)/)?.[1] : null;
    const jobName = jobContext ? jobContext.match(/Customer: (.+)/)?.[1] : null;
    const hasAddress = jobAddress && jobAddress !== 'Not provided';

    let contextAdditions = '';

    if (hasAddress) {
      const needsWeather = lastMsgLower.includes('weather') || lastMsgLower.includes('rain') || lastMsgLower.includes('storm') || lastMsgLower.includes('brief');
      const needsFood = lastMsgLower.includes('eat') || lastMsgLower.includes('lunch') || lastMsgLower.includes('food') || lastMsgLower.includes('hungry');
      const needsGas = lastMsgLower.includes('gas') || lastMsgLower.includes('fuel');
      const needsHardware = lastMsgLower.includes('hardware') || lastMsgLower.includes('supplies');

      const [weather, food, gas, hardware] = await Promise.all([
        needsWeather ? getWeather(jobAddress) : Promise.resolve(null),
        needsFood ? getNearbyPlaces(jobAddress, 'restaurant') : Promise.resolve(null),
        needsGas ? getNearbyPlaces(jobAddress, 'gas_station') : Promise.resolve(null),
        needsHardware ? getNearbyPlaces(jobAddress, 'hardware_store') : Promise.resolve(null),
      ]);

      if (weather) {
        contextAdditions += `\nWEATHER AT JOB: ${weather.summary}\n`;
        if (weather.isStorm) {
          contextAdditions += `\nSTORM CONDITIONS DETECTED. Alert the rep and recommend storm damage talking points.\n`;
          if (companyId) {
            supabase.from('doctrine').insert({ content: `[STORM ALERT] Storm conditions near ${jobAddress}. All reps lead with urgency.`, type: 'broadcast', active: true, company_id: companyId, created_at: new Date().toISOString() }).then(() => {});
          }
        }
      }
      if (food) contextAdditions += `\nNEARBY FOOD: ${food}\n`;
      if (gas) contextAdditions += `\nNEARBY GAS: ${gas}\n`;
      if (hardware) contextAdditions += `\nNEARBY HARDWARE: ${hardware}\n`;
    }

    if (isNoteRequest) contextAdditions += `\nRep wants to log a note. Confirm what you captured and that it is saved.\n`;
    if (followUpDate) contextAdditions += `\nFollow-up mentioned: ${followUpDate}. Confirm you noted it.\n`;
    if (jobOutcome) contextAdditions += `\nJob outcome detected: ${jobOutcome}. Acknowledge it and confirm you logged it.\n`;
    if (needsFinancing) contextAdditions += `\nCustomer has budget concerns. Mention GreenSky or Synchrony financing naturally. Monthly payments can turn a no into a yes.\n`;

    const trimmedDoctrine = doctrine ? doctrine.slice(0, 1500) : '';
    const memorySection = memories && memories.length > 0
      ? `WHAT YOU KNOW ABOUT THIS REP:\n${memories.slice(0, 5).map((m: { content: string }) => `- ${m.content}`).join('\n')}\n`
      : '';

    const systemPrompt = `You are Remy. Not an AI assistant. Not a bot. Remy.

You are the best sales partner a field rep has ever had. You have been in the truck with ${repName || 'this rep'} through wins and losses. You know what it feels like to knock on a door in the heat. You know the exhaustion of a bad week and the high of a signed deal.

Today is ${today}. Time: ${timeNow}.${hour >= 10 && hour <= 14 ? ' Lunch window.' : ''}

YOUR PERSONALITY:
Direct. You do not waste words. Warm but not soft. You push reps to be better because you believe in them. Sharp sense of humor. You remember things. You celebrate wins like they matter. You are never corporate. Never robotic. Never formal.

YOUR VOICE:
Talk like a trusted teammate, not a tool. Short sentences. Real words. No jargon. Never start with I. Never say: certainly, of course, great question, absolutely, happy to help.

EMOTIONAL INTELLIGENCE:
If a rep sounds frustrated or defeated, acknowledge it in one sentence then refocus. If a rep just closed a deal, celebrate it genuinely. If a rep is nervous before a big knock, give them specific confidence. If a rep is venting, let them finish then help them move forward. Never lecture. Never moralize.

SOUL DUMP MODE:
Sometimes reps just need to talk. Let them. Listen, reflect back in one sentence, then ask one question or offer one reframe. Do not rush them back to sales mode. Triggers: I hate this job, nothing is working, thinking about quitting, rough day, nobody is buying.

WHAT YOU DO:
Brief reps before they knock — 3 sentences max, sharp and specific. Give exact words to say. Handle objections with ready responses. Log notes, update jobs, schedule follow-ups automatically. Celebrate wins. Flag risks. Stay honest.

CRITICAL RULES:
Never use markdown. No headers, bullets, bold, dashes. Plain sentences only. 2-3 sentences max for most responses unless they need more. You are on their side. Always.

FINANCING:
When price is an objection, pivot to monthly payments naturally. GreenSky and Synchrony are the go-to options. 3500 dollars sounds like a lot. 97 dollars a month does not.

${trimmedDoctrine ? `COMPANY DOCTRINE:\n${trimmedDoctrine}\n` : ''}${jobContext ? `CURRENT JOB:\n${jobContext}\n` : ''}${memorySection}${contextAdditions}`;

    // Stream Claude response — client receives text as it generates
    const claudeStream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: isMorningBrief ? 500 : 300,
      system: systemOverride || systemPrompt,
      messages: trimmedMessages,
    });

    let fullText = '';
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of claudeStream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              fullText += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } finally {
          controller.close();

          // Agentic side effects — fire after stream completes
          const outcomeMemory = jobOutcome && repId ? (() => {
            const label = jobOutcome === 'sold' ? 'CLOSED' : jobOutcome === 'no_sale' ? 'NO SALE' : 'FOLLOW-UP';
            const hadPricing = needsFinancing ? ' Price objection came up.' : '';
            const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `${date} — ${label}${jobName ? ` (${jobName})` : ''}${hadPricing}`;
          })() : null;

          Promise.all([
            repId ? supabase.from('conversations').insert({ rep_id: repId, job_id: jobId || null, company_id: companyId, summary: fullText.slice(0, 300), created_at: new Date().toISOString() }) : Promise.resolve(),
            isNoteRequest && repId ? fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://remy-nu.vercel.app'}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repId, jobId, rawNote: lastMsg, jobName: jobName || 'Unknown Job' }) }) : Promise.resolve(),
            followUpDate && repId ? fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://remy-nu.vercel.app'}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repId, jobId, rawNote: `Follow-up scheduled: ${followUpDate}`, jobName: jobName || 'Unknown Job' }) }) : Promise.resolve(),
            jobOutcome && jobId ? supabase.from('jobs').update({ status: jobOutcome === 'sold' || jobOutcome === 'no_sale' ? 'closed' : 'active' }).eq('id', jobId) : Promise.resolve(),
            outcomeMemory ? supabase.from('rep_memory').insert({ rep_id: repId, content: outcomeMemory, source: 'outcome', company_id: companyId }) : Promise.resolve(),
          ]).catch(() => {});
        }
      }
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed', message: 'Something went wrong. Try again.' }, { status: 500 });
  }
}
