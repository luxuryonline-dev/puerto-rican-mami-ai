import { useCheckout } from '@shipwords/core/react/account';
import type { Product } from '@shipwords/core/site';
import { getRouteApi, Link } from '@tanstack/react-router';
import { type MouseEvent, type ReactNode, useEffect, useRef } from 'react';
import { authClient } from '~/lib/auth';
import { track } from '~/lib/track';
import { m } from '~/paraglide/messages.js';
import { openSignIn } from '~/site/sign-in';
import { packValue } from './pack-value';
import site from '../../site.config';

// No separate pricing page: buy from the home #pricing section; other entry points (nav, low credits, account) open a dialog in place.
// Change prices in site.config.ts only.

const OPEN_EVENT = 'site:pricing';
/** Checkout success and cancel both return here; on resume the home page restores the generator from sessionStorage and shows a notice. */
export const RESUME_PATH = '/?resume=1#create';

export function openPricing(source: string) {
  track('pricing_open', { source });
  window.dispatchEvent(new Event(OPEN_EVENT));
}

export function formatPrice(product: Product) {
  const amount = money(product.price.amount, product.price.currency);
  return product.kind === 'subscription' ? `${amount}/${product.interval}` : amount;
}

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function describe(product: Product) {
  if (product.kind === 'subscription') {
    return m.common_plan_subscription({
      credits: product.creditsPerPeriod.toLocaleString(),
      interval: product.interval,
    });
  }
  return product.expiresDays
    ? m.common_plan_credits_expiring({ credits: product.credits.toLocaleString(), days: product.expiresDays })
    : m.common_plan_credits({ credits: product.credits.toLocaleString() });
}

/** Link to pricing: opens the dialog with JS, falls back to the home pricing section without. */
export function PricingLink({
  className,
  source,
  children,
}: {
  className?: string;
  source: string;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useValidAnchor: with JS the click opens the dialog; without JS the href still reaches the home pricing section.
    <a
      href="/#pricing"
      className={className}
      onClick={(e: MouseEvent) => {
        e.preventDefault();
        openPricing(source);
      }}
    >
      {children}
    </a>
  );
}

const root = getRouteApi('__root__');

/** Plan cards and buy buttons; signed-out users sign in first, then go straight to checkout. */
export function Plans({
  heading: Heading = 'h3',
  source = 'section',
}: {
  heading?: 'h2' | 'h3';
  /** Goes into the checkout_start event: section for the home pricing block, dialog for the dialog. */
  source?: string;
}) {
  const config = root.useLoaderData();
  const session = authClient(config.googleClientId).useSession();
  const { checkout, pending, error } = useCheckout();
  const starter = site.products[0];
  const bestUnitPrice = Math.min(...site.products.map(product => packValue(product)?.perVideoCents ?? Infinity));

  function buy(productId: string) {
    if (!config.billingReady) return;
    // After paying, return to the generator; its input is restored from sessionStorage (routes/index.tsx).
    const start = () => {
      track('checkout_start', { product: productId, source });
      void checkout(productId, RESUME_PATH);
    };
    if (session.data) start();
    else openSignIn(start, 'checkout');
  }

  useEffect(() => {
    if (error) track('checkout_failed', { error: error.slice(0, 100) });
  }, [error]);

  return (
    <>
      <div className="plans">
        {site.products.map((product) => {
          const value = packValue(product);
          const bestValue = Boolean(value && value.savingsCents > 0 && value.perVideoCents === bestUnitPrice);
          return <article key={product.id} className={`plan value-plan${bestValue ? ' best-value-plan' : ''}`}>
            <div className="plan-offer"><span className={`plan-badge${value && value.savingsCents > 0 ? ' has-savings' : ''}`}>
              {bestValue ? 'Best value �� ' : ''}{value && value.savingsCents > 0 ? `Save ${value.savingsPercent}%` : 'One-time pack'}
            </span></div>
            <Heading>{product.name}</Heading>
            <p className="price">{formatPrice(product)}</p>
            {value && <p className="plan-unit-price">{money(value.perVideoCents, product.price.currency)} <span>per video</span></p>}
            <div className="plan-value-details">
              {value && value.savingsCents > 0 ? <>
                <p className="plan-savings">Save <strong>{money(value.savingsCents, product.price.currency)}</strong></p>
                <p className="plan-comparison">vs. {money(value.comparisonCents, product.price.currency)} buying Starter packs</p>
              </> : <><p className="plan-savings">Start with one video.</p><p className="plan-comparison">Try the routine with your own photos.</p></>}
            </div>
            <p className="plan-credits">{describe(product)}</p>
            <button
              type="button"
              className="primary"
              disabled={pending !== null || !config.billingReady}
              onClick={() => buy(product.id)}
            >
              {!config.billingReady ? 'Available at launch' : pending === product.id
                ? m.common_plan_redirecting()
                : product.kind === 'subscription'
                  ? m.common_plan_subscribe()
                  : value ? `Get ${value.videos} ${value.videos === 1 ? 'video' : 'videos'}` : m.common_plan_buy()}
            </button>
          </article>
        })}
      </div>
      {starter && <p className="pricing-savings-note">Savings compared with buying the same number of videos in Starter packs at {formatPrice(starter)} each. One-time payment, no subscription.</p>}
      {error && <p className="error">{error}</p>}
      <p className="muted">
        {m.common_pay_fine()} {/* Opens in a new tab so the dialog and generator input are kept. */}
        <Link to="/refunds" target="_blank" rel="noopener">
          {m.common_pay_refund_policy()}
        </Link>
      </p>
    </>
  );
}

export function PricingDialog() {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const onOpen = () => dialog.current?.showModal();
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  function close() {
    dialog.current?.close();
  }

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: clicking the backdrop is a mouse shortcut; keyboards close with native Esc.
    <dialog
      ref={dialog}
      className="dialog pricing-dialog"
      aria-labelledby="pricing-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <button type="button" className="dialog-close" aria-label={m.common_close()} onClick={close}>
        ��
      </button>
      <h2 id="pricing-title">{m.common_pricing_dialog_title()}</h2>
      <Plans source="dialog" />
    </dialog>
  );
}
