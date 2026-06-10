import { describe, it, expect } from 'vitest';
import {
  detectNoteIntent,
  detectFollowUp,
  detectJobOutcome,
  detectFinancingNeed,
  detectCompetitor,
  extractDollarAmount,
  detectBroadcast,
  detectIntentsRegex,
  EMPTY_INTENTS,
} from '../intents';

describe('detectNoteIntent', () => {
  it('detects explicit note requests', () => {
    expect(detectNoteIntent('hey log this: homeowner wants cedar shakes')).toBe(true);
    expect(detectNoteIntent('make a note that the gate code is 4421')).toBe(true);
  });
  it('ignores normal chat', () => {
    expect(detectNoteIntent('what should I say at the door')).toBe(false);
  });
});

describe('detectFollowUp', () => {
  it('detects follow-up phrases with a day', () => {
    expect(detectFollowUp('follow up on monday')).toMatch(/monday/i);
    expect(detectFollowUp('I should call them back tomorrow')).toMatch(/tomorrow/i);
    expect(detectFollowUp('check back next week')).toMatch(/next week/i);
  });
  it('returns null without a time reference', () => {
    expect(detectFollowUp('I will follow my gut')).toBeNull();
  });
});

describe('detectJobOutcome', () => {
  it('detects sold', () => {
    expect(detectJobOutcome('they signed the deal!')).toBe('sold');
    expect(detectJobOutcome('we got the contract')).toBe('sold');
  });
  it('detects no_sale', () => {
    expect(detectJobOutcome('they passed on it')).toBe('no_sale');
    expect(detectJobOutcome('not moving forward')).toBe('no_sale');
  });
  it('detects follow_up', () => {
    expect(detectJobOutcome('they want to think about it')).toBe('follow_up');
  });
  it('returns null otherwise', () => {
    expect(detectJobOutcome('heading to the next house')).toBeNull();
  });
});

describe('detectFinancingNeed', () => {
  it('detects budget objections', () => {
    expect(detectFinancingNeed('she said it was too expensive')).toBe(true);
    expect(detectFinancingNeed('asking about a payment plan')).toBe(true);
  });
  it('ignores unrelated messages', () => {
    expect(detectFinancingNeed('roof looks great')).toBe(false);
  });
});

describe('detectCompetitor', () => {
  it('detects named competitors', () => {
    expect(detectCompetitor('they got a quote from Storm Guard')).toBe('"storm guard"');
  });
  it('detects unnamed competitor mentions', () => {
    expect(detectCompetitor('they already have a quote from another contractor')).toBe('a competitor');
  });
  it('returns null otherwise', () => {
    expect(detectCompetitor('beautiful day out here')).toBeNull();
  });
});

describe('extractDollarAmount', () => {
  it('requires deal context', () => {
    expect(extractDollarAmount('my phone number is 5551234567')).toBeNull();
    expect(extractDollarAmount('$15,000')).toBeNull();
  });
  it('parses k-suffix amounts', () => {
    expect(extractDollarAmount('they signed for $22k')).toBe(22000);
    expect(extractDollarAmount('signed for 22.5k')).toBe(22500);
  });
  it('parses plain dollar amounts', () => {
    expect(extractDollarAmount('the quote is $15,000')).toBe(15000);
  });
  it('parses written numbers', () => {
    expect(extractDollarAmount('deal is eighteen thousand')).toBe(18000);
    expect(extractDollarAmount('contract is twenty two thousand')).toBe(22000);
  });
  it('rejects out-of-range values', () => {
    expect(extractDollarAmount('the quote is $5')).toBeNull();
    expect(extractDollarAmount('deal is worth $9,000,000')).toBeNull();
  });
});

describe('detectBroadcast', () => {
  it('captures broadcast text', () => {
    expect(detectBroadcast('broadcast to the team: storm rolling in, push inspections')).toBe('storm rolling in, push inspections');
    expect(detectBroadcast('broadcast: lunch at noon')).toBe('lunch at noon');
  });
  it('returns null without the keyword', () => {
    expect(detectBroadcast('tell everyone I said hi')).toBeNull();
  });
});

describe('detectIntentsRegex', () => {
  it('returns empty intents for empty input', () => {
    expect(detectIntentsRegex('')).toEqual(EMPTY_INTENTS);
  });
  it('combines multiple detections', () => {
    // Note the regex needs the literal "signed for" — "signed the deal for $22k"
    // misses the amount. The model-based extractIntents path handles paraphrases.
    const intents = detectIntentsRegex('they signed for $22k, log this');
    expect(intents.jobOutcome).toBe('sold');
    expect(intents.dealAmount).toBe(22000);
    expect(intents.isNoteRequest).toBe(true);
  });
});
