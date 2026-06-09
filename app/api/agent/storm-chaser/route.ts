// app/api/agent/storm-chaser/route.ts
// After a major storm, finds affected addresses and creates job leads
// Zeus calls this when storm-scan detects a major event

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(req: NextRequest) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const { companyId, stormLocation, stormType, affectedZipCodes } = await req.json();
    if (!companyId || !stormLocation) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });

    // Get active reps for this company
    const { data: reps } = await supabase.from('profiles').select('clerk_id, full_name').eq('company_id', companyId).eq('role', 'rep');

    // Generate storm canvassing brief via Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `Generate a storm canvassing brief for home services reps. Return JSON only.

Storm: ${stormType} near ${stormLocation}
Zip Codes: ${(affectedZipCodes || []).join(', ')}

Return: {
  "doorKnockerScript": "exact words to say at door after storm",
  "urgencyFrame": "why they need to act NOW not later",
  "commonObjections": {"objection1": "response1", "objection2": "response2"},
  "insurancePitch": "how to introduce insurance claim process",
  "priority": "high/medium/low based on storm type"
}`
      }]
    });

    let brief: any = {};
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      brief = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch { brief = { doorKnockerScript: 'Hi, I was in the area and noticed the storm last night. We are doing free damage assessments for homeowners in the area. Would you like me to take a quick look?', urgencyFrame: 'Insurance claims have time limits. The sooner you file, the better your coverage.', priority: 'high' }; }

    // Broadcast storm chaser brief to all reps
    const broadcastMsg = `[STORM CHASER] ${stormType} detected near ${stormLocation}. Door knocker: "${brief.doorKnockerScript}" Priority: ${brief.priority?.toUpperCase()}`;
    
    await supabase.from('doctrine').insert({
      content: broadcastMsg,
      type: 'broadcast',
      active: true,
      company_id: companyId,
      created_at: new Date().toISOString(),
    });

    // Push individual brief to each rep
    for (const rep of reps || []) {
      await supabase.from('conversations').insert({
        rep_id: rep.clerk_id,
        company_id: companyId,
        summary: `[STORM CHASER] Storm hit ${stormLocation}. Get out there. Script: ${brief.doorKnockerScript?.slice(0, 150)}`,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ 
      success: true, 
      brief,
      repsNotified: (reps || []).length,
      affectedZipCodes: affectedZipCodes || [],
    });
  } catch (error) {
    console.error('Storm chaser error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
