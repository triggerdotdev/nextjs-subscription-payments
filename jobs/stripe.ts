import { client, stripe, supabase } from '@/trigger';
import {
  deletePriceRecord,
  manageSubscriptionStatusChange,
  upsertPriceRecord,
  upsertProductRecord
} from '@/utils/supabase-admin';

client.defineJob({
  id: 'stripe-product-changed',
  name: 'Stripe Product Changed',
  version: '0.0.1',
  trigger: stripe.onProduct({ events: ['product.created', 'product.updated'] }),
  integrations: {
    supabase
  },
  run: async (payload, io) => {
    await upsertProductRecord(payload, io.supabase);
  }
});

client.defineJob({
  id: 'stripe-price-deleted',
  name: 'Stripe Price Deleted',
  version: '0.0.1',
  trigger: stripe.onProductDeleted(),
  integrations: {
    supabase
  },
  run: async (payload, io) => {
    await io.supabase.runTask('🗑', async (db) => {
      const { error } = await db.from('products').delete().eq('id', payload.id);

      if (error) throw error;
    });
  }
});

client.defineJob({
  id: 'stripe-price-changed',
  name: 'Stripe Price Changed',
  version: '0.0.1',
  trigger: stripe.onPrice(),
  integrations: {
    supabase
  },
  run: async (payload, io, ctx) => {
    if (ctx.event.name === 'price.deleted') {
      await deletePriceRecord(payload.id, io.supabase);
    } else {
      await upsertPriceRecord(payload, io.supabase);
    }
  }
});

client.defineJob({
  id: 'stripe-subscription-changed',
  name: 'Stripe Subscription Changed',
  version: '0.0.1',
  trigger: stripe.onCustomerSubscription({
    events: [
      'customer.subscription.created',
      'customer.subscription.updated',
      'customer.subscription.deleted'
    ]
  }),
  integrations: {
    supabase,
    stripe
  },
  run: async (payload, io, ctx) => {
    await manageSubscriptionStatusChange(io, {
      subscriptionId: payload.id,
      customerId: payload.customer as string,
      createAction: ctx.event.name === 'customer.subscription.created'
    });
  }
});

client.defineJob({
  id: 'stripe-session-completed',
  name: 'Stripe Checkout Session Completed',
  version: '0.0.1',
  trigger: stripe.onCheckoutSessionCompleted({
    filter: {
      mode: ['subscription']
    }
  }),
  integrations: {
    supabase,
    stripe
  },
  run: async (payload, io, ctx) => {
    await manageSubscriptionStatusChange(io, {
      subscriptionId: payload.subscription as string,
      customerId: payload.customer as string,
      createAction: true
    });
  }
});
