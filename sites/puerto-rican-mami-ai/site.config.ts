import { defineSite, type SiteConfig } from '@shipwords/core/site';

// All config for this site. Prices are in the smallest currency unit (cents). Do not change id after launch.
export default defineSite<SiteConfig>({
  id: 'puertoricanmamia',
  name: 'Puerto Rican Mami AI',
  url: 'https://puertoricanmamiai.com',
  locales: ['en'],
  defaultLocale: 'en',
  products: [
    { id: 'starter', kind: 'credits', name: 'Starter �� 3 videos', price: { amount: 999, currency: 'usd' }, credits: 30, expiresDays: null },
    { id: 'creator', kind: 'credits', name: 'Creator �� 10 videos', price: { amount: 2499, currency: 'usd' }, credits: 100, expiresDays: null },
    { id: 'studio', kind: 'credits', name: 'Studio �� 25 videos', price: { amount: 4999, currency: 'usd' }, credits: 250, expiresDays: null },
  ],
  signup: { bonusCredits: 0, bonusExpiresDays: null, bonusPerIpDaily: 0 },
  guest: { dailyPerDevice: 0, dailyPerIp: 0, dailySiteBudget: 0, minRecaptchaScore: 0.5 },
  billing: { provider: 'stripe', automaticTax: false },
  analytics: {},
});
