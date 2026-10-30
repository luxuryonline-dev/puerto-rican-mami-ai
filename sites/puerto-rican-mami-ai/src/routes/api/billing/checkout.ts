import { createFileRoute } from '@tanstack/react-router';
import { core } from '~/core.server';
import { errorResponse } from '@shipwords/core/http';

export const Route = createFileRoute('/api/billing/checkout')({
  server: { handlers: { POST: ({ request }) =>
    core.site.url.includes('example.com') || !core.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
      ? errorResponse(503, 'checkout_unavailable', 'Checkout opens when this site launches.')
      : core.billing.checkout(request),
  } },
});
