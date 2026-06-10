import Anthropic from '@anthropic-ai/sdk';

export interface Intents {
  isNoteRequest: boolean;
  followUpDate: string | null;
  jobOutcome: 'sold' | 'no_sale' | 'follow_up' | null;
  needsFinancing: boolean;
  competitor: string | null;
  dealAmount: number | null;
  broadcastText: string | null;
}

export const EMPTY_INTENTS: Intents = {
  isNoteRequest: false,
  followUpDate: null,
  jobOutcome: null,
  needsFinancing: false,
  competitor: null,
  dealAmount: null,
  broadcastText: null,
};

// ---------------------------------------------------------------------------
// Regex detectors — fallback path when the model extraction call fails.
// ---------------------------------------------------------------------------

export function detectNoteIntent(msg: string): boolean {
  return ['log this', 'note this', 'remember this', 'save this', 'write that down', 'log it', 'make a note', 'record this'].some(k => msg.toLowerCase().includes(k));
}

export function detectFollowUp(msg: string): string | null {
  const patterns = [
    /follow.?up (on |this )?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)/i,
    /call (them|him|her)? ?(back)? ?(monday|tuesday|wednesday|thursday|friday|tomorrow|next week)/i,
    /check back (monday|tuesday|wednesday|thursday|friday|tomorrow|next week)/i,
  ];
  for (const p of patterns) { const m = msg.match(p); if (m) return m[0]; }
  return null;
}

export function detectJobOutcome(msg: string): 'sold' | 'no_sale' | 'follow_up' | null {
  const lower = msg.toLowerCase();
  if (/(they signed|signed the deal|closed it|got the job|sold it|they said yes|closed the deal|got the contract)/.test(lower)) return 'sold';
  if (/(they passed|no sale|not interested|lost it|they said no|not moving forward|passed on it)/.test(lower)) return 'no_sale';
  if (/(follow up|they want to think|need to think about it|get back to me)/.test(lower)) return 'follow_up';
  return null;
}

export function detectFinancingNeed(msg: string): boolean {
  return /(too expensive|cant afford|price is high|out of budget|financing|payment plan|monthly payments)/.test(msg.toLowerCase());
}

export function detectCompetitor(msg: string): string | null {
  const lower = msg.toLowerCase();
  const named = ['storm guard', 'power home', 'hansons', 'leafguard', 'abc seamless', '1-800-hansons', 'best pick', 'central exteriors', 'champion windows', 'pella', 'andersen'];
  for (const c of named) { if (lower.includes(c)) return `"${c}"`; }
  if (/(another company|other company|different company|another contractor|other bid|lower bid|cheaper bid|got a quote from|going with someone else|they offered|someone else came by|already have a quote|already got a quote)/.test(lower)) return 'a competitor';
  return null;
}

export function extractDollarAmount(msg: string): number | null {
  if (typeof msg !== 'string') return null;
  const lower = msg.toLowerCase();
  // Must have deal/scope context to avoid false positives
  if (!/\b(signed for|scope is|job is worth|deal is|deal worth|total is|quote is|estimate is|quoting|priced at|price is|contract for|contract is|sold for|came to|came out to|looking at about|project is|billing them|invoice is|figure of)\b/.test(lower)) return null;
  // Numeric with K suffix: $22k, 22k, $22.5k
  const kMatch = lower.match(/\$?\s*([\d,]+\.?\d*)\s*k\b/);
  if (kMatch) {
    const amt = parseFloat(kMatch[1].replace(/,/g, '')) * 1000;
    if (amt >= 200 && amt <= 500000) return Math.round(amt);
  }
  // Numeric with "thousand": 22 thousand
  const thousandNumMatch = lower.match(/\$?\s*([\d,]+\.?\d*)\s*thousand/);
  if (thousandNumMatch) {
    const amt = parseFloat(thousandNumMatch[1].replace(/,/g, '')) * 1000;
    if (amt >= 200 && amt <= 500000) return Math.round(amt);
  }
  // Plain dollar: $15,000 or $15000
  const dollarMatch = lower.match(/\$\s*([\d,]+)/);
  if (dollarMatch) {
    const amt = parseFloat(dollarMatch[1].replace(/,/g, ''));
    if (amt >= 200 && amt <= 500000) return Math.round(amt);
  }
  // Written numbers: "eighteen thousand", "twenty two thousand five hundred"
  const ONES: Record<string, number> = {
    one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
    nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
    fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
    twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
    eighty: 80, ninety: 90,
  };
  const wordRx = /\b((?:(?:twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]?(?:one|two|three|four|five|six|seven|eight|nine)?|(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)))\s+(thousand|hundred)\b/g;
  let m;
  while ((m = wordRx.exec(lower)) !== null) {
    const parts = m[1].replace(/-/g, ' ').trim().split(/\s+/);
    let val = 0;
    for (const p of parts) { if (ONES[p] !== undefined) val += ONES[p]; }
    if (m[2] === 'thousand') val *= 1000;
    else if (m[2] === 'hundred') val *= 100;
    if (val >= 200 && val <= 500000) return val;
  }
  return null;
}

export function detectBroadcast(msg: string): string | null {
  if (typeof msg !== 'string') return null;
  const m = msg.toLowerCase().match(/\bbroadcast(?:\s+to\s+(?:the\s+)?(?:team|everyone|all reps?))?[:\s]+(.+)/);
  if (m && m[1]?.trim().length > 3) return m[1].trim().slice(0, 300);
  return null;
}

export function detectIntentsRegex(msg: string): Intents {
  if (typeof msg !== 'string' || !msg) return EMPTY_INTENTS;
  return {
    isNoteRequest: detectNoteIntent(msg),
    followUpDate: detectFollowUp(msg),
    jobOutcome: detectJobOutcome(msg),
    needsFinancing: detectFinancingNeed(msg),
    competitor: detectCompetitor(msg),
    dealAmount: extractDollarAmount(msg),
    broadcastText: detectBroadcast(msg),
  };
}

// ---------------------------------------------------------------------------
// Model-based extraction — primary path. One small Haiku call understands
// paraphrases the regexes miss ("contract's in" → sold). Falls back to the
// regex detectors on any error so chat never breaks.
// ---------------------------------------------------------------------------

const INTENT_TOOL: Anthropic.Tool = {
  name: 'record_intents',
  description: 'Record sales intents detected in a field rep\'s message. Only flag an intent when the message clearly expresses it — when in doubt, leave it null/false.',
  input_schema: {
    type: 'object',
    properties: {
      log_note: { type: 'boolean', description: 'Rep explicitly asks to log/save/note/record something.' },
      follow_up: { type: ['string', 'null'], description: 'If the rep mentions following up, calling back, or checking back at a specific time (e.g. "Tuesday", "tomorrow", "next week"), the short phrase describing when. Otherwise null.' },
      job_outcome: { type: ['string', 'null'], enum: ['sold', 'no_sale', 'follow_up', null], description: '"sold" if the customer signed/closed/said yes. "no_sale" if they declined or the deal is lost. "follow_up" if the customer wants time to think or asked the rep to come back. Null if no outcome is stated.' },
      financing_concern: { type: 'boolean', description: 'Customer raised price/budget objections or asked about financing or payment plans.' },
      competitor: { type: ['string', 'null'], description: 'If a competing company or competing bid/quote is mentioned, the competitor name in quotes, or "a competitor" if unnamed. Otherwise null.' },
      deal_amount: { type: ['number', 'null'], description: 'Dollar value of the deal/quote/contract if the rep states one ("signed for 22k" → 22000, "eighteen thousand" → 18000). Only when tied to the deal — never phone numbers, addresses, or measurements. Otherwise null.' },
      broadcast: { type: ['string', 'null'], description: 'Only if the rep explicitly says "broadcast" a message to the team: the message text. Otherwise null.' },
    },
    required: ['log_note', 'follow_up', 'job_outcome', 'financing_concern', 'competitor', 'deal_amount', 'broadcast'],
  },
};

export async function extractIntents(anthropic: Anthropic, msg: string): Promise<Intents> {
  if (typeof msg !== 'string' || msg.trim().length < 4) return EMPTY_INTENTS;
  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: 'You extract structured sales intents from a home-services field rep\'s chat message. The rep talks casually about door knocks, quotes, customers, and deals. Be conservative: only record an intent the message clearly states.',
      tools: [INTENT_TOOL],
      tool_choice: { type: 'tool', name: 'record_intents' },
      messages: [{ role: 'user', content: msg.slice(0, 4000) }],
    });
    const block = res.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!block) return detectIntentsRegex(msg);
    const input = block.input as any;
    const outcome = ['sold', 'no_sale', 'follow_up'].includes(input.job_outcome) ? input.job_outcome : null;
    const amount = typeof input.deal_amount === 'number' && input.deal_amount >= 200 && input.deal_amount <= 500000 ? Math.round(input.deal_amount) : null;
    return {
      isNoteRequest: input.log_note === true,
      followUpDate: typeof input.follow_up === 'string' && input.follow_up.trim() ? input.follow_up.trim().slice(0, 100) : null,
      jobOutcome: outcome,
      needsFinancing: input.financing_concern === true,
      competitor: typeof input.competitor === 'string' && input.competitor.trim() ? input.competitor.trim().slice(0, 80) : null,
      dealAmount: amount,
      broadcastText: typeof input.broadcast === 'string' && input.broadcast.trim().length > 3 ? input.broadcast.trim().slice(0, 300) : null,
    };
  } catch (error) {
    console.error('Intent extraction failed, falling back to regex:', error);
    return detectIntentsRegex(msg);
  }
}
