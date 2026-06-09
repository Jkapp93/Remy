// app/api/agent/adjuster-brief/route.ts
// Generates insurance adjuster talking points for a specific job
// Rep calls this when job is tagged as insurance claim

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const ADJUSTER_KNOWLEDGE = `
KEY INSURANCE CLAIM FACTS FOR REPS:
- Adjusters work for the insurance company, not the homeowner
- Adjusters are trained to minimize payouts
- Wind speed matters â€” document everything above 50mph events
- Hail size matters â€” quarter size (1 inch) is threshold for most carriers
- Age of roof matters â€” actual cash value vs replacement cost value
- Depreciation can be recovered if policy has RCV (replacement cost value)
- Supplementing is normal â€” first estimate is rarely final
- Code upgrades (ISO/IBC) must be included if local codes changed
- Minimum slopes, drip edge, ice and water shield are common line items missed
- O&P (overhead and profit) â€” contractors are entitled to this on insurance jobs

COMMON ADJUSTER TACTICS TO COUNTER:
- "Pre-existing damage" â€” counter with weather records and neighbor comparisons
- "Normal wear and tear" â€” counter with storm event documentation
- "Only partial damage" â€” counter with matching requirements in policy
- "We'll use our preferred contractor" â€” homeowner has right to choose contractor
- "That's not covered" â€” request specific policy language in writing
- "Low estimate" â€” supplement with Xactimate codes and material costs

LINE ITEMS ADJUSTERS MISS:
- Starter strips, ridge cap, pipe boots, vents
- Decking replacement if damaged
- Permits and inspections
- Dumpster/haul away
- Drip edge if code requires
- Ice and water shield in cold climates
- Satellite dish reinstall
- O&P on complex jobs
`;

export async function POST(req: NextRequest) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  try {
    const { jobId, jobType, damageDescription, carrierName } = await req.json();

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are an expert public adjuster helping a home services rep prepare for an insurance adjuster visit. Return JSON only.

Job Type: ${jobType || 'roofing'}
Carrier: ${carrierName || 'unknown'}
Damage Description: ${damageDescription || 'storm damage'}

Knowledge Base:
${ADJUSTER_KNOWLEDGE}

Return: {
  "opener": "exact words to say when adjuster arrives",
  "keyPoints": ["point 1", "point 2", "point 3"],
  "watchOut": ["common tactic 1 this carrier uses", "tactic 2"],
  "lineItems": ["item 1 to make sure is included", "item 2", "item 3"],
  "closingAsk": "exact words to use at end of inspection",
  "redFlags": "what to do if adjuster says these things"
}`
      }]
    });

    let scripts: any = {};
    try {
      const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
      scripts = JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch { scripts = { opener: 'Thanks for coming out. Let me walk you through what we documented.', keyPoints: ['Document all damage', 'Note storm event date', 'Get everything in writing'], watchOut: ['Low initial estimate', 'Pre-existing damage claim'], lineItems: ['O&P', 'Permits', 'Starter strips'], closingAsk: 'Can you confirm what the next steps are and when we can expect the estimate?' }; }

    // Save as doctrine/context for this job session
    if (jobId) {
      await supabase.from('job_notes').insert({
        job_id: jobId,
        raw_note: `Adjuster brief generated for ${carrierName || 'insurance'} claim`,
        summary: `Adjuster visit prep: ${scripts.opener?.slice(0, 100)}`,
        key_details: scripts.keyPoints,
        created_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, scripts });
  } catch (error) {
    console.error('Adjuster brief error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
