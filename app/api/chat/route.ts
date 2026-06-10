import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { auth } from '@clerk/nextjs/server';
import { extractIntents, EMPTY_INTENTS } from '@/lib/intents';
import { buildSoul } from '@/lib/remySoul';

const PLAN_LIMITS: Record<string, number> = { free: 20, solo: 150, command: 500, enterprise: 99999 };

// Server-only key (set GOOGLE_MAPS_KEY in Vercel). Falls back to the legacy
// public key until the new var is configured everywhere.
const MAPS_KEY = process.env.GOOGLE_MAPS_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;

async function getWeather(address: string) {
  try {
    const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`);
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

async function getNearbyPlaces(address: string, type: string, directLat?: number, directLng?: number) {
  try {
    let lat: number, lng: number;
    if (directLat && directLng) {
      lat = directLat; lng = directLng;
    } else {
      const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${MAPS_KEY}`);
      const geoData = await geoRes.json();
      if (!geoData.results?.[0]) return null;
      ({ lat, lng } = geoData.results[0].geometry.location);
    }
    const res = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=2000&type=${type}&key=${MAPS_KEY}`);
    const data = await res.json();
    return data.results?.slice(0, 4).map((p: any) => `${p.name} (${p.vicinity})${p.rating ? ` ${p.rating} stars` : ''}`).join(', ') || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { messages, doctrine, jobContext, memories, repId, jobId, systemOverride, isMorningBrief, userLat, userLng } = await req.json();

    // Auth: if repId is provided, the session must belong to that rep
    if (repId) {
      const { userId } = await auth();
      if (!userId || userId !== repId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Cap history to keep tokens lean in long sessions
    const trimmedMessages = Array.isArray(messages) ? messages.slice(-12) : messages;

    // Input length cap — prevent token-burning attacks (2000 chars ≈ ~500 tokens)
    const lastMsgContent = trimmedMessages[trimmedMessages.length - 1]?.content;
    if (typeof lastMsgContent === 'string' && lastMsgContent.length > 4000) {
      return NextResponse.json({ message: 'Message too long. Keep it under 4000 characters.', rateLimited: false });
    }

    // systemOverride is only permitted for unauthenticated demo requests.
    // When a real repId + valid session is present, strip it to prevent prompt injection.
    const safeSystemOverride = repId ? null : (typeof systemOverride === 'string' ? systemOverride.slice(0, 2000) : null);

    const lastMsg = messages[messages.length - 1]?.content || '';
    const lastMsgLower = typeof lastMsg === 'string' ? lastMsg.toLowerCase() : '';

    // Kick off intent extraction now so it overlaps the profile and
    // weather/places lookups below. extractIntents never throws — it falls
    // back to regex detection internally. Demo traffic skips it (no side
    // effects fire without a repId, so the extra Haiku call is pure cost).
    const intentsPromise = repId ? extractIntents(anthropic, lastMsg) : Promise.resolve(EMPTY_INTENTS);

    // Inline rate limit — no HTTP self-call, no extra latency
    let companyId: string | null = null;
    let repName: string | null = null;
    let agentName = 'Remy';
    if (repId) {
      const today = new Date().toISOString().split('T')[0];
      const [profileRes, usageRes] = await Promise.all([
        supabase.from('profiles').select('company_id, full_name, companies(plan, agent_name)').eq('clerk_id', repId).single(),
        supabase.from('usage_daily').select('id, count').eq('rep_id', repId).eq('date', today).single(),
      ]);
      companyId = profileRes.data?.company_id || null;
      repName = profileRes.data?.full_name || null;
      const companyData = profileRes.data?.companies as any;
      const plan = companyData?.plan || 'free';
      agentName = companyData?.agent_name || 'Remy';
      const limit = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
      const count = usageRes.data?.count || 0;
      if (count >= limit) {
        return NextResponse.json({ message: `You've used all ${limit} messages for today. Resets at midnight.`, rateLimited: true });
      }
      // Increment usage — atomic upsert via RPC. Note: supabase-js queries
      // are lazy; `.then()` is what actually starts them, so never `void` a
      // bare query builder (that was a no-op and broke rate limiting).
      supabase.rpc('increment_usage', { p_rep_id: repId, p_date: today }).then(
        () => {},
        (e) => console.error('Usage increment failed:', e)
      );
    } else {
      // Unauthenticated demo traffic: hard daily cap per IP so /api/chat
      // can't be farmed as a free Claude proxy.
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      const ipKey = `demo:${createHash('sha256').update(ip).digest('hex').slice(0, 32)}`;
      const today = new Date().toISOString().split('T')[0];
      const { data: demoUsage } = await supabase.from('usage_daily').select('id, count').eq('rep_id', ipKey).eq('date', today).single();
      const demoCount = demoUsage?.count || 0;
      if (demoCount >= 10) {
        return NextResponse.json({ message: "That's the demo limit for today. Sign up to keep talking to Remy.", rateLimited: true });
      }
      // Await this one: demo abuse is exactly when we can't afford a lost increment
      const { error: incErr } = await supabase.rpc('increment_usage', { p_rep_id: ipKey, p_date: today });
      if (incErr) console.error('Demo usage increment failed:', incErr);
    }

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const timeNow = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const hour = new Date().getHours();

    const jobAddress = jobContext ? jobContext.match(/Address: (.+)/)?.[1] : null;
    const jobName = jobContext ? jobContext.match(/Customer: (.+)/)?.[1] : null;
    const hasAddress = jobAddress && jobAddress !== 'Not provided';
    const hasGps = userLat && userLng;
    const canLookup = hasAddress || hasGps;

    let contextAdditions = '';

    if (canLookup) {
      const needsWeather = lastMsgLower.includes('weather') || lastMsgLower.includes('rain') || lastMsgLower.includes('storm') || lastMsgLower.includes('brief');
      const needsFood = lastMsgLower.includes('eat') || lastMsgLower.includes('lunch') || lastMsgLower.includes('food') || lastMsgLower.includes('hungry') || lastMsgLower.includes('restaurant') || lastMsgLower.includes('chick') || lastMsgLower.includes('burger') || lastMsgLower.includes('closest') || lastMsgLower.includes('near me') || lastMsgLower.includes('nearby') || lastMsgLower.includes('where') || lastMsgLower.includes('grab');
      const needsGas = lastMsgLower.includes('gas') || lastMsgLower.includes('fuel') || lastMsgLower.includes('station');
      const needsHardware = lastMsgLower.includes('hardware') || lastMsgLower.includes('supplies') || lastMsgLower.includes('home depot') || lastMsgLower.includes('lowes');

      const addr = jobAddress || '';
      const [weather, food, gas, hardware] = await Promise.all([
        needsWeather && hasAddress ? getWeather(addr) : Promise.resolve(null),
        needsFood ? getNearbyPlaces(addr, 'restaurant', userLat, userLng) : Promise.resolve(null),
        needsGas ? getNearbyPlaces(addr, 'gas_station', userLat, userLng) : Promise.resolve(null),
        needsHardware ? getNearbyPlaces(addr, 'hardware_store', userLat, userLng) : Promise.resolve(null),
      ]);

      if (weather) {
        contextAdditions += `\nWEATHER AT JOB: ${weather.summary}\n`;
        if (weather.isStorm) {
          contextAdditions += `\nSTORM CONDITIONS DETECTED. Alert the rep and recommend storm damage talking points.\n`;
          if (companyId) {
            supabase.from('doctrine').insert({ content: `[STORM ALERT] Storm conditions near ${jobAddress}. All reps lead with urgency.`, type: 'broadcast', active: true, company_id: companyId, created_at: new Date().toISOString() }).then(
              () => {},
              (e) => console.error('Storm alert insert failed:', e)
            );
          }
        }
      }
      if (food) contextAdditions += `\nNEARBY FOOD: ${food}\n`;
      if (gas) contextAdditions += `\nNEARBY GAS: ${gas}\n`;
      if (hardware) contextAdditions += `\nNEARBY HARDWARE: ${hardware}\n`;
    }

    const { isNoteRequest, followUpDate, jobOutcome, needsFinancing, competitor, dealAmount, broadcastText } = await intentsPromise;

    if (isNoteRequest) contextAdditions += `\nRep wants to log a note. Confirm what you captured and that it is saved.\n`;
    if (followUpDate) contextAdditions += `\nFollow-up mentioned: ${followUpDate}. Confirm you noted it.\n`;
    if (jobOutcome) contextAdditions += `\nJob outcome detected: ${jobOutcome}. Acknowledge it and confirm you logged it.\n`;
    if (needsFinancing) contextAdditions += `\nCustomer has budget concerns. Mention GreenSky or Synchrony financing naturally. Monthly payments can turn a no into a yes.\n`;
    if (competitor) contextAdditions += `\nCOMPETITOR ALERT: Rep mentioned ${competitor}. Critical moment. Stay confident — never trash them by name. Pivot to what this company does differently: workmanship warranty, local crew, no subs, material quality, BBB standing. Hit them with: "We're not here to compete on who's cheapest. We compete on who you won't have to call back." Use any doctrine rebuttals if available.\n`;
    if (dealAmount) contextAdditions += `\nDEAL VALUE DETECTED: $${dealAmount.toLocaleString()}. Acknowledge it, celebrate or reframe appropriately, and confirm you saved it to the job.\n`;
    if (broadcastText) contextAdditions += `\nBROADCAST SENT: Rep broadcast "${broadcastText}" to the whole team. Confirm it went out.\n`;

    const trimmedDoctrine = doctrine ? doctrine.slice(0, 1500) : '';
    const memorySection = memories && memories.length > 0
      ? `WHAT YOU KNOW ABOUT THIS REP:\n${memories.slice(0, 5).map((m: { content: string }) => `- ${m.content}`).join('\n')}\n`
      : '';

    // Split the system prompt for prompt caching: the soul + doctrine block is
    // stable across a rep's session and gets a cache breakpoint; everything
    // time- or message-dependent goes in the second, uncached block.
    const staticSoul = buildSoul({ agentName, repName, doctrine: trimmedDoctrine });
    const dynamicContext = `Today is ${today}. Time: ${timeNow}.${hour >= 10 && hour <= 14 ? ' Lunch window.' : ''}
${jobContext ? `\nCURRENT JOB:\n${jobContext}\n` : ''}${memorySection}${contextAdditions}`;

    // Stream Claude response — client receives text as it generates
    const claudeStream = anthropic.messages.stream({
      // Demo traffic gets Haiku + a tighter cap — plenty for a taste, useless as a proxy
      model: repId ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001',
      max_tokens: isMorningBrief ? 500 : repId ? 300 : 200,
      system: safeSystemOverride || [
        { type: 'text', text: staticSoul, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: dynamicContext },
      ],
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
            dealAmount && jobId ? supabase.from('jobs').update({ deal_value: dealAmount }).eq('id', jobId) : Promise.resolve(),
            broadcastText && companyId ? supabase.from('doctrine').insert({ content: `[BROADCAST] ${broadcastText}`, type: 'broadcast', active: true, company_id: companyId, created_at: new Date().toISOString() }) : Promise.resolve(),
          ]).catch((e) => console.error('Chat side effects failed:', e));
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
