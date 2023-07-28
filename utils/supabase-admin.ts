import { stripe, supabase } from '@/trigger';
import { Database } from '@/types_db';
import { toDateTime } from '@/utils/helpers';
import type {
  IOWithIntegrations,
  IntegrationIO,
  TriggerPayload
} from '@trigger.dev/sdk';
import type { Stripe } from 'stripe';

export type SupabaseProduct = Database['public']['Tables']['products']['Row'];
export type SupabasePrice = Database['public']['Tables']['prices']['Row'];
export type CreateSupabaseSubscriptionInput =
  Database['public']['Tables']['subscriptions']['Insert'];

export async function createOrRetrieveCustomer({
  email,
  uuid
}: {
  email: string;
  uuid: string;
}) {
  const { data, error } = await supabase.native
    .from('customers')
    .select('stripe_customer_id')
    .eq('id', uuid)
    .single();

  if (error || !data?.stripe_customer_id) {
    // No customer record found, let's create one.
    const customerData: {
      metadata: { supabaseUUID: string };
      email?: string;
    } = {
      metadata: {
        supabaseUUID: uuid
      }
    };
    if (email) customerData.email = email;
    const customer = await stripe.native.customers.create(customerData);
    // Now insert the customer ID into our Supabase mapping table.
    const { error: supabaseError } = await supabase.native
      .from('customers')
      .insert([{ id: uuid, stripe_customer_id: customer.id }]);
    if (supabaseError) throw supabaseError;
    console.log(`New customer created and inserted for ${uuid}.`);
    return customer.id;
  }
  return data.stripe_customer_id;
}

export async function upsertProductRecord(
  payload: TriggerPayload<ReturnType<typeof stripe.onProductCreated>>,
  ioSupa: IntegrationIO<typeof supabase>
) {
  await ioSupa.runTask('🆙', async (db) => {
    const { error, data } = await db
      .from('products')
      .upsert([buildSupabaseProduct(payload)])
      .select('*');

    if (error) throw error;

    return data[0];
  });
}

export async function upsertPriceRecord(
  payload: TriggerPayload<ReturnType<typeof stripe.onPriceCreated>>,
  ioSupa: IntegrationIO<typeof supabase>
) {
  await ioSupa.runTask('🆙', async (db) => {
    const { error, data } = await db
      .from('prices')
      .upsert([buildSupabasePrice(payload)])
      .select('*');

    if (error) throw error;

    return data[0];
  });
}

export async function manageSubscriptionStatusChange(
  io: IOWithIntegrations<{ supabase: typeof supabase; stripe: typeof stripe }>,
  {
    subscriptionId,
    customerId,
    createAction = false
  }: { subscriptionId: string; customerId: string; createAction: boolean }
) {
  // Get customer's UUID from mapping table.
  const customer = await io.supabase.runTask('lookup-customer', async (db) => {
    const { data, error } = await db
      .from('customers')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (error) throw error;

    return data;
  });

  // Retrieve the full subscription object from Stripe with the default payment method.
  const subscription = await io.stripe.retrieveSubscription(
    'Get subscription',
    { id: subscriptionId, expand: ['default_payment_method'] }
  );

  // Upsert the subscription in Supabase.
  const supabaseSubscription: CreateSupabaseSubscriptionInput = {
    id: subscription.id,
    user_id: customer.id,
    metadata: subscription.metadata,
    status: subscription.status,
    price_id: subscription.items.data[0].price.id,
    //TODO check quantity on subscription
    // @ts-ignore
    quantity: subscription.quantity,
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at: toOptionalSupabaseDate(subscription.cancel_at),
    canceled_at: toOptionalSupabaseDate(subscription.canceled_at),
    current_period_start: toSupabaseDate(subscription.current_period_start),
    current_period_end: toSupabaseDate(subscription.current_period_end),
    created: toSupabaseDate(subscription.created),
    ended_at: toOptionalSupabaseDate(subscription.ended_at),
    trial_start: toOptionalSupabaseDate(subscription.trial_start),
    trial_end: toOptionalSupabaseDate(subscription.trial_end)
  };

  await io.supabase.runTask('upsert-sub', async (db) => {
    const { error } = await db
      .from('subscriptions')
      .upsert([supabaseSubscription]);

    if (error) throw error;
  });

  // We only want to update the customer's billing details if this is the first subscription they've created.
  if (!createAction) {
    return;
  }

  // Copy the billing details from the payment method to the customer object.
  const default_payment_method = subscription.default_payment_method;

  if (
    typeof default_payment_method !== 'string' &&
    default_payment_method != null
  ) {
    const { name, phone, address } = default_payment_method.billing_details;

    if (!name || !phone || !address) return;

    await io.stripe.updateCustomer('update-customer', {
      id: default_payment_method.customer as string,
      name,
      phone,
      // @ts-ignore the typings for address are wrong in the Stripe SDK (city type is string or undefined, not string or null)
      address
    });

    await io.supabase.runTask('update-supa-user', async (db) => {
      const { error } = await db
        .from('users')
        .update({
          billing_address: { ...address },
          payment_method: {
            ...default_payment_method[default_payment_method.type]
          }
        })
        .eq('id', customer.id);

      if (error) throw error;
    });
  }
}

function buildSupabaseProduct(product: Stripe.Product): SupabaseProduct {
  return {
    id: product.id,
    active: product.active,
    name: product.name,
    description: product.description ?? null,
    image: product.images?.[0] ?? null,
    metadata: product.metadata
  };
}

function buildSupabasePrice(price: Stripe.Price): SupabasePrice {
  return {
    id: price.id,
    product_id: typeof price.product === 'string' ? price.product : '',
    active: price.active,
    currency: price.currency,
    description: price.nickname ?? null,
    type: price.type,
    unit_amount: price.unit_amount ?? null,
    interval: price.recurring?.interval ?? null,
    interval_count: price.recurring?.interval_count ?? null,
    trial_period_days: price.recurring?.trial_period_days ?? null,
    metadata: price.metadata
  };
}

function toOptionalSupabaseDate(seconds?: number | null): string | null {
  if (!seconds) return null;

  return toSupabaseDate(seconds);
}

function toSupabaseDate(seconds: number): string {
  return toDateTime(seconds).toISOString();
}
