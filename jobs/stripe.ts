import { client, stripe, supabase } from '@/trigger';
import {
  manageSubscriptionStatusChange,
  upsertPriceRecord,
  upsertProductRecord
} from '@/utils/supabase-admin';

client.defineJob({
  id: 'stripe-product-created',
  name: 'Stripe Product Created',
  version: '0.0.1',
  trigger: stripe.onProductCreated(),
  integrations: {
    supabase
  },
  run: async (payload, io) => {
    await upsertProductRecord(payload, io.supabase);
  }
});

client.defineJob({
  id: 'stripe-product-updated',
  name: 'Stripe Product Updated',
  version: '0.0.1',
  trigger: stripe.onProductUpdated(),
  integrations: {
    supabase
  },
  run: async (payload, io) => {
    await upsertProductRecord(payload, io.supabase);
  }
});

client.defineJob({
  id: 'stripe-product-updated',
  name: 'Stripe Product Updated',
  version: '0.0.1',
  trigger: stripe.onProductUpdated(),
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
  id: 'stripe-price-created',
  name: 'Stripe Price Created',
  version: '0.0.1',
  trigger: stripe.onPriceCreated(),
  integrations: {
    supabase
  },
  run: async (payload, io) => {
    await upsertPriceRecord(payload, io.supabase);
  }
});

client.defineJob({
  id: 'stripe-price-updated',
  name: 'Stripe Price Updated',
  version: '0.0.1',
  trigger: stripe.onPriceUpdated(),
  integrations: {
    supabase
  },
  run: async (payload, io) => {
    await upsertPriceRecord(payload, io.supabase);
  }
});

client.defineJob({
  id: 'stripe-price-deleted',
  name: 'Stripe Price Deleted',
  version: '0.0.1',
  trigger: stripe.onPriceDeleted(),
  integrations: {
    supabase
  },
  run: async (payload, io) => {
    await io.supabase.runTask('🗑', async (db) => {
      const { error } = await db.from('prices').delete().eq('id', payload.id);

      if (error) throw error;
    });
  }
});

client.defineJob({
  id: 'stripe-subscription-created',
  name: 'Stripe Subscription Created',
  version: '0.0.1',
  trigger: stripe.onCustomerSubscriptionCreated(),
  integrations: {
    supabase,
    stripe
  },
  run: async (payload, io, ctx) => {
    await manageSubscriptionStatusChange(io, {
      subscriptionId: payload.id,
      customerId: payload.customer as string,
      createAction: true
    });
  }
});

client.defineJob({
  id: 'stripe-subscription-updated',
  name: 'Stripe Subscription Updated',
  version: '0.0.1',
  trigger: stripe.onCustomerSubscriptionUpdated(),
  integrations: {
    supabase,
    stripe
  },
  run: async (payload, io, ctx) => {
    await manageSubscriptionStatusChange(io, {
      subscriptionId: payload.id,
      customerId: payload.customer as string,
      createAction: false
    });
  }
});

client.defineJob({
  id: 'stripe-subscription-deleted',
  name: 'Stripe Subscription Deleted',
  version: '0.0.1',
  trigger: stripe.onCustomerSubscriptionDeleted(),
  integrations: {
    supabase,
    stripe
  },
  run: async (payload, io, ctx) => {
    await manageSubscriptionStatusChange(io, {
      subscriptionId: payload.id,
      customerId: payload.customer as string,
      createAction: false
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
