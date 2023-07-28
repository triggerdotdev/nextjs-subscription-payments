import { TriggerClient } from '@trigger.dev/sdk';
import { Stripe } from '@trigger.dev/stripe';
import { Supabase } from '@trigger.dev/supabase';
import { Database } from '@/types_db';

export const client = new TriggerClient({
  id: 'nextjs-subscription-payments',
  apiKey: process.env.TRIGGER_API_KEY,
  apiUrl: process.env.TRIGGER_API_URL
});

export const stripe = new Stripe({
  id: 'stripe',
  apiKey: process.env.STRIPE_SECRET_KEY!
});

export const supabase = new Supabase<Database>({
  id: 'supabase',
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
});
