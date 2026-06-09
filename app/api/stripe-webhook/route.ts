import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;
  try {
    if (!sig || !webhookSecret) throw new Error('Missing signature or secret');
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Webhook signature invalid' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const clerkId = session.metadata?.clerkId || session.client_reference_id;
    const plan = session.metadata?.plan;
    const customerId = session.customer as string;

    if (clerkId && plan) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('clerk_id', clerkId)
        .single();

      if (profile?.company_id) {
        await supabase
          .from('companies')
          .update({ plan, stripe_customer_id: customerId })
          .eq('id', profile.company_id);
      }
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription;
    const customerId = sub.customer as string;

    await supabase
      .from('companies')
      .update({ plan: 'free' })
      .eq('stripe_customer_id', customerId);
  }

  return NextResponse.json({ received: true });
}
