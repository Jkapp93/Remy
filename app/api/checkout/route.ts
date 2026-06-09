import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' });
    const PLANS = {
      solo: process.env.STRIPE_SOLO_PRICE_ID!,
      command: process.env.STRIPE_TEAM_PRICE_ID!,
      enterprise: process.env.STRIPE_COMPANY_PRICE_ID!,
    };
    const { plan, email, clerkId } = await req.json();
    if (!plan || !PLANS[plan as keyof typeof PLANS]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: PLANS[plan as keyof typeof PLANS], quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: clerkId || undefined,
      success_url: 'https://remy-nu.vercel.app/dashboard?welcome=true',
      cancel_url: 'https://remy-nu.vercel.app/pricing',
      metadata: { plan, clerkId: clerkId || '' },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}
