import assert from 'node:assert/strict';
import test from 'node:test';
import { canUseLiveCheckout } from '../src/site/billing-readiness.ts';

const site = 'https://puertoricanmamiai.com';
test('recognizes live restricted keys and live secret keys', () => {
  assert.equal(canUseLiveCheckout(site, 'rk_live_fixture'), true);
  assert.equal(canUseLiveCheckout(site, 'sk_live_fixture'), true);
});
test('test keys, publishable keys and absent keys cannot enable live checkout', () => {
  for (const key of [undefined, '', 'pk_live_fixture', 'pk_test_fixture', 'sk_test_fixture', 'rk_test_fixture', 'whsec_fixture']) {
    assert.equal(canUseLiveCheckout(site, key), false);
  }
});
test('template domains cannot enable live checkout', () => {
  assert.equal(canUseLiveCheckout('https://example.com', 'rk_live_fixture'), false);
  assert.equal(canUseLiveCheckout('https://example.com', 'sk_live_fixture'), false);
});
