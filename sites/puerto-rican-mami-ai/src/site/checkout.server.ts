import { errorResponse, readJson } from '@shipwords/core/http';
import { core } from '~/core.server';
import site from '../../site.config';
import { canUseLiveCheckout } from './billing-readiness';

export async function checkout(request: Request): Promise<Response> {
  if (!canUseLiveCheckout(core.site.url, core.env.STRIPE_SECRET_KEY))
    return errorResponse(503, 'checkout_unavailable', 'Checkout is temporarily unavailable.');
  const body = await readJson<{ productId?: unknown }>(request);
  if (!body || !site.products.some(product => product.id === body.productId))
    return errorResponse(400, 'pack_changed', 'This credit pack has changed. Refresh the page and choose a current pack.');
  return core.billing.checkout(new Request(request.url, {
    method: 'POST', headers: request.headers, body: JSON.stringify(body),
  }));
}
