import type Stripe from 'stripe';
import { describe, expect, it, vi } from 'vitest';
import type { CheckoutRequest } from '../src/billing/provider';
import { StripeProvider } from '../src/billing/stripe';

describe('Stripe Checkout on accounts with Managed Payments enabled by default', () => {
  it.each(['credits', 'subscription'] as const)(
    'creates standard Payments sessions for %s without requiring a product tax code',
    async (kind) => {
      const create = vi.fn(
        async (params: Stripe.Checkout.SessionCreateParams, _options?: Stripe.RequestOptions) => {
          // Reproduce Stripe's account-default rejection unless the session opts out explicitly.
          if (params.managed_payments?.enabled !== false) {
            throw new Error('The product tax code is missing for Managed Payments');
          }
          return { id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' };
        },
      );
      const stripe = { checkout: { sessions: { create } } } as unknown as Stripe;
      const provider = new StripeProvider(
        { secretKey: 'sk_test_fake', webhookSecret: 'whsec_fake', automaticTax: false },
        stripe,
      );
      const product: CheckoutRequest['product'] =
        kind === 'credits'
          ? {
              id: 'pack_100',
              kind: 'credits',
              name: '100 credits',
              price: { amount: 1000, currency: 'usd' },
              credits: 100,
              expiresDays: null,
            }
          : {
              id: 'pro_month',
              kind: 'subscription',
              name: 'Pro',
              price: { amount: 2000, currency: 'usd' },
              interval: 'month',
              creditsPerPeriod: 300,
            };
      const request: CheckoutRequest = {
        orderId: 'ord_1',
        siteId: 'test',
        userId: 'u1',
        customerRef: 'cus_1',
        product,
        successUrl: 'https://test.example/billing/return',
        cancelUrl: 'https://test.example/',
      };

      await expect(provider.createCheckout(request)).resolves.toEqual({
        checkoutRef: 'cs_1',
        url: 'https://checkout.stripe.com/c/pay/cs_1',
      });
      const [params, options] = create.mock.calls[0]!;
      expect(params.mode).toBe(kind === 'credits' ? 'payment' : 'subscription');
      expect(params.line_items?.[0]?.price_data).toMatchObject({
        currency: 'usd',
        unit_amount: product.price.amount,
        product_data: { name: product.name },
      });
      expect(params.automatic_tax).toBeUndefined();
      expect(params.metadata).toMatchObject({ orderId: 'ord_1', userId: 'u1', productId: product.id });
      expect(options).toEqual({ idempotencyKey: 'checkout:ord_1' });
    },
  );
});
