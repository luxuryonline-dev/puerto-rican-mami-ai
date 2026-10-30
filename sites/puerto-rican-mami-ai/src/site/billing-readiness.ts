/** Recognize both Stripe live server-key types; Stripe enforces the key's permissions. */
export function canUseLiveCheckout(siteUrl: string, key: string | undefined): boolean {
  return !siteUrl.includes('example.com') && Boolean(
    key?.startsWith('sk_live_') || key?.startsWith('rk_live_'),
  );
}
