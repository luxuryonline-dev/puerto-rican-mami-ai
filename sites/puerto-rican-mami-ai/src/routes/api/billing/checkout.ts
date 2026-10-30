import { createFileRoute } from '@tanstack/react-router';
import { core } from '~/core.server';
import { errorResponse } from '@shipwords/core/http';
import { canUseLiveCheckout } from '~/site/billing-readiness';

export const Route = createFileRoute('/api/billing/checkout')({
  server: { handlers: { POST: ({ request }) =>
    !canUseLiveCheckout(core.site.url, core.env.STRIPE_SECRET_KEY)
      ? errorResponse(503, 'checkout_unavailable', 'Checkout opens when this site launches.')
      : core.billing.checkout(request),
  } },
});
