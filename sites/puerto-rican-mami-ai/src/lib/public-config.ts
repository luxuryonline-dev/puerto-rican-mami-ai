import { createServerFn } from '@tanstack/react-start';
import { canUseLiveCheckout } from '~/site/billing-readiness';

// Public config the browser needs (reCAPTCHA site key, Google client ID). Values come from wrangler vars or .dev.vars, not baked into the build.
export const getPublicConfig = createServerFn({ method: 'GET' }).handler(async () => {
  const { core } = await import('~/core.server');
  const env = core.env;
  const { mockMode } = await import('@shipwords/jobs/mock');
  const { siteMedia } = await import('~/site/media.server');
  return {
    recaptchaSiteKey: env.RECAPTCHA_SITE_KEY || null,
    googleClientId: env.GOOGLE_CLIENT_ID || null,
    mock: Boolean(mockMode(env as unknown as Parameters<typeof mockMode>[0])),
    previewOnly: false,
    media: await siteMedia(),
    billingReady: canUseLiveCheckout(core.site.url, env.STRIPE_SECRET_KEY),
  };
});
