import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' });

const PRICE_MAP: Record<string, string> = {
  'price_solo': process.env.STRIPE_PRICE_SOLO || '',
  'price_team': process.env.STRIPE_PRICE_TEAM || '',
  'price_company': process.env.STRIPE_PRICE_COMPANY || '',
};

export async function POST(req: NextRequest) {
  try {
    const { priceId, planName } = await req.json();
    const stripePriceId = PRICE_MAP[priceId];

    if (!stripePriceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: { planName },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
