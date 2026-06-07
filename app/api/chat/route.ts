import { REMY_SOUL } from '../../../lib/remySoul';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// â”€â”€â”€ FIELD INTEL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getWeather(address: string) {
  try {
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`);
    const geoData = await geoRes.json();
    if (!geoData.results?.[0]) return null;
    const { lat, lng } = geoData.results[0].geometry.location;
    const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=imperial`);
    const data = await res.json();
    const conditions = data.weather[0].description.toLowerCase();
    const isStorm = conditions.includes('storm') || conditions.includes('thunder') || conditions.includes('hurricane') || data.wind.speed > 35;
    return {
      summary: `${data.weather[0].description}, ${Math.round(data.main.temp)}F, humidity ${data.main.humidity}%, wind ${Math.round(data.wind.speed)}mph`,
      isStorm,
      conditions,
      temp: data.main.temp,
      wind: data.wind.speed,
      lat,
      lng,
    };
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

// â”€â”€â”€ INTENT DETECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function detectNoteIntent(msg: string): boolean {
  const keywords = ['log this', 'note this', 'remember this', 'save this', 'write that down', 'log it', 'make a note', 'jot that down', 'record this'];
  return keywords.some(k => msg.toLowerCase().includes(k));
}

function detectFollowUp(msg: string): string | null {
  const patterns = [
    /follow.?up (on |this )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)/i,
    /call (them|him|her)? ?(back)? ?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)/i,
    /check back (monday|tuesday|wednesday|thursday|friday|tomorrow|next week)/i,
    /circle back (monday|tuesday|wednesday|thursday|friday|tomorrow|next week)/i,
  ];
  for (const p of patterns) {
    const match = msg.match(p);
    if (match) return match[0];
  }
  return null;
}

function detectJobOutcome(msg: string): string | null {
  const lower = msg.toLowerCase();
  if (/(they signed|signed the deal|closed it|got the job|sold it|they bought|contract signed|got the contract|they said yes|closed the deal)/.test(lower)) return 'sold';
  if (/(they passed|no sale|didn't sell|not interested|lost it|they said no|won't buy|not moving forward|passed on it)/.test(lower)) return 'no_sale';
  if (/(follow up|following up|coming back|check back|they want to think|need to think about it|get back to me)/.test(lower)) return 'follow_up';
  return null;
}

function detectFinancingNeed(msg: string): boolean {
  const lower = msg.toLowerCase();
  return /(too expensive|can't afford|price is high|out of budget|financing|payment plan|monthly|how much down|payments)/.test(lower);
}

// â”€â”€â”€ AGENTIC ACTIONS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function autoLogSession(repId: string, jobId: string | null, messages: any[], summary: string, companyId: string | null) {
  await supabase.from('conversations').insert({
    rep_id: repId,
    job_id: jobId || null,
    company_id: companyId,
    summary: summary.slice(0, 300),
    created_at: new Date().toISOString(),
  });
}

async function autoSaveNote(repId: string, jobId: string | null, rawNote: string, jobName: string) {
  try {
    await fetch('https://remy-nu.vercel.app/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repId, jobId, rawNote, jobName }),
    });
  } catch {}
}

async function updateJobStatus(jobId: string, status: string) {
  if (!jobId) return;
  const mappedStatus = status === 'sold' ? 'closed' : status === 'no_sale' ? 'closed' : 'active';
  await supabase.from('jobs').update({ 
    status: mappedStatus,
    notes: `Outcome: ${status} â€” logged by Remy on ${new Date().toLocaleDateString()}`
  }).eq('id', jobId);
}

async function broadcastStormAlert(companyId: string, jobAddress: string, weather: any) {
  if (!companyId) return;
  const msg = `STORM ALERT: ${weather.conditions} conditions near ${jobAddress}. Wind ${Math.round(weather.wind)}mph. Brief all reps on storm damage talking points before knocking.`;
  await supabase.from('doctrine').insert({
    content: `[STORM ALERT] ${msg}`,
    type: 'broadcast',
    active: true,
    company_id: companyId,
    created_at: new Date().toISOString(),
  });
}

async function saveFollowUp(repId: string, jobId: string | null, date: string, jobName: string) {
  await autoSaveNote(repId, jobId, `Follow-up scheduled: ${date} for ${jobName || 'this job'}`, jobName);
}

async function getCompanyId(repId: string): Promise<string | null> {
  const { data } = await supabase.from('profiles').select('company_id').eq('clerk_id', repId).single();
  return data?.company_id || null;
}

async function updateRepMemory(repId: string, companyId: string | null, insight: string) {
  if (!repId || !insight) return;
  const existing = await supabase.from('rep_memory').select('content').eq('rep_id', repId).single();
  const content = existing.data?.content
    ? existing.data.content + '\n' + insight
    : insight;
  await supabase.from('rep_memory').upsert({ rep_id: repId, company_id: companyId, content }, { onConflict: 'rep_id' });
}

// â”€â”€â”€ MAIN HANDLER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: NextRequest) {
  try {
    const { messages, doctrine, jobContext, memories, repId, jobId } = await req.json();

    // Rate limit check
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
        fetch('https://remy-nu.vercel.app/api/rate-limit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repId }),
        }).catch(() => {});
      }
    }

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const hour = new Date().getHours();
    const lastMsg = messages[messages.length - 1]?.content || '';
    const lastMsgLower = lastMsg.toLowerCase();

    // Get company ID for agentic actions
    const companyId = repId ? await getCompanyId(repId) : null;

    // Detect intents
    const isNoteRequest = detectNoteIntent(lastMsgLower);
    const followUpDate = detectFollowUp(lastMsgLower);
    const jobOutcome = detectJobOutcome(lastMsgLower);
    const needsFinancing = detectFinancingNeed(lastMsgLower);

    const jobAddress = jobContext ? jobContext.match(/Address: (.+)/)?.[1] : null;
    const jobName = jobContext ? jobContext.match(/Customer: (.+)/)?.[1] : null;
    const hasAddress = jobAddress && jobAddress !== 'Not provided';

    // â”€â”€ FIELD INTEL â”€â”€
    let contextAdditions = '';
    let weatherData: any = null;

    if (hasAddress) {
      const needsWeather = lastMsgLower.includes('weather') || lastMsgLower.includes('rain') || lastMsgLower.includes('wind') || lastMsgLower.includes('storm') || lastMsgLower.includes('brief');
      const needsFood = lastMsgLower.includes('eat') || lastMsgLower.includes('lunch') || lastMsgLower.includes('food') || lastMsgLower.includes('hungry');
      const needsGas = lastMsgLower.includes('gas') || lastMsgLower.includes('fuel');
      const needsHardware = lastMsgLower.includes('hardware') || lastMsgLower.includes('supplies');

      const [weather, food, gas, hardware] = await Promise.all([
        needsWeather || lastMsgLower.includes('brief') ? getWeather(jobAddress) : Promise.resolve(null),
        needsFood ? getNearbyPlaces(jobAddress, 'restaurant') : Promise.resolve(null),
        needsGas ? getNearbyPlaces(jobAddress, 'gas_station') : Promise.resolve(null),
        needsHardware ? getNearbyPlaces(jobAddress, 'hardware_store') : Promise.resolve(null),
      ]);

      if (weather) {
        weatherData = weather;
        contextAdditions += `\nWEATHER AT JOB: ${weather.summary}\n`;
        if (weather.isStorm) {
          contextAdditions += `\nSTORM CONDITIONS DETECTED. Alert the rep. Recommend storm damage talking points.\n`;
          // Agentic: broadcast storm alert to company
          if (companyId) broadcastStormAlert(companyId, jobAddress, weather).catch(() => {});
        }
      }
      if (food) contextAdditions += `\nNEARBY FOOD: ${food}\n`;
      if (gas) contextAdditions += `\nNEARBY GAS: ${gas}\n`;
      if (hardware) contextAdditions += `\nNEARBY HARDWARE: ${hardware}\n`;
    }

    // â”€â”€ INTENT CONTEXT â”€â”€
    if (isNoteRequest) contextAdditions += `\nRep wants to log a note. Confirm what you captured and that it is saved.\n`;
    if (followUpDate) contextAdditions += `\nFollow-up mentioned: ${followUpDate}. Confirm you noted it and will remind them.\n`;
    if (jobOutcome) contextAdditions += `\nJob outcome detected: ${jobOutcome}. Acknowledge it, log it, and transition naturally.\n`;
    if (needsFinancing) contextAdditions += `\nCustomer may have budget concerns. Mention financing options like GreenSky or Synchrony if appropriate. Monthly payments can turn a no into a yes.\n`;

    const memorySection = memories && memories.length > 0
      ? `WHAT YOU KNOW ABOUT THIS REP:\n${memories.map((m: { content: string }) => `- ${m.content}`).join('\n')}\n`
      : '';

    const systemPrompt = REMY_SOUL({ today, timeNow, isLunchWindow: hour >= 10 && hour <= 14, doctrine, jobContext, memorySection, contextAdditions, repName: undefined });
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

    // â”€â”€ AGENTIC ACTIONS (fire and forget) â”€â”€
    Promise.all([
      // 1. Auto-log every session to conversations
      repId ? autoLogSession(repId, jobId || null, messages, text, companyId) : Promise.resolve(),

      // 2. Save note if requested
      isNoteRequest && repId ? autoSaveNote(repId, jobId || null, lastMsg, jobName || 'Unknown Job') : Promise.resolve(),

      // 3. Save follow-up as note
      followUpDate && repId ? saveFollowUp(repId, jobId || null, followUpDate, jobName || 'Unknown Job') : Promise.resolve(),

      // 4. Update job status if outcome detected
      jobOutcome && jobId ? updateJobStatus(jobId, jobOutcome) : Promise.resolve(),

      // 5. Update rep memory with session insight
      repId && jobOutcome ? updateRepMemory(repId, companyId, `On ${today} at ${jobName || 'a job'}: outcome was ${jobOutcome}`) : Promise.resolve(),
    ]).catch(() => {});

    return NextResponse.json({ message: text });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json({ error: 'Failed', message: 'Something went wrong. Try again.' }, { status: 500 });
  }
}