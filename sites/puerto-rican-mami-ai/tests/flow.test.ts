import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { getBalance, grantCredits } from '@shipwords/core/credits/ledger';
import { payments } from '@shipwords/core/db/schema';
import { createCore } from '@shipwords/core/server';
import { MockAdapter } from '@shipwords/jobs/mock';
import { runGeneration } from '@shipwords/jobs/runner';
import { buildYirRequest } from '@shipwords/jobs/yir';
import { core, jobsApi } from '../src/core.server';
import { createDance, uploadMotion } from '../src/site/motion.server';
import { checkout } from '../src/site/checkout.server';
import { fixedReference, serveSiteMedia, siteMedia } from '../src/site/media.server';
import { isSiteMedia, SITE_MEDIA } from '../src/site/media';
import { SceneControls } from '../src/site/scene-controls';
import { SCENE_DESCRIPTION_LIMIT, type SceneMode } from '../src/site/scene';
import models from '../site.models';
import site from '../site.config';
import { env, LocalD1, LocalR2 } from './support/local-worker';

const base = 'http://localhost:6365';
const db = new LocalD1();
const bucket = new LocalR2();
const emails: any[] = [];
const dispatched: string[] = [];
const terminated: string[] = [];
Object.assign(env, {
  DB: db, OUTPUTS: bucket, APP_URL: base,
  BETTER_AUTH_SECRET: randomBytes(32).toString('hex'), GUEST_COOKIE_SECRET: randomBytes(32).toString('hex'),
  EMAIL_FROM: 'noreply@example.org', EMAIL: { send: async (message: any) => { emails.push(message); } },
  UPSTREAM_MOCK: '1', YIR_API_KEY: '',
  GENERATION_WORKFLOW: { create: async ({ id }: any) => { dispatched.push(id); return { id }; },
    get: async (id: string) => ({ terminate: async () => { terminated.push(id); } }) },
});
for (const file of fs.readdirSync('migrations').filter(file => file.endsWith('.sql')).sort())
  db.sqlite.exec(fs.readFileSync(path.join('migrations', file), 'utf8'));

const cookies = new Map<string, string>();
function remember(response: Response) {
  for (const raw of response.headers.getSetCookie()) { const [pair] = raw.split(';'); const at = pair.indexOf('='); cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
}
function request(url: string, body?: any, extra: Record<string, string> = {}, signedIn = true) {
  const headers = new Headers({ origin: base, 'cf-connecting-ip': '198.51.100.9', ...extra });
  if (signedIn) headers.set('cookie', [...cookies].map(([k, v]) => k + '=' + v).join('; '));
  if (body === undefined) return new Request(base + url, { headers });
  const bytes = body instanceof Uint8Array ? body : JSON.stringify(body);
  if (!(body instanceof Uint8Array)) headers.set('content-type', 'application/json');
  headers.set('content-length', String(typeof bytes === 'string' ? Buffer.byteLength(bytes) : bytes.byteLength));
  return new Request(base + url, { method: 'POST', headers, body: bytes });
}
async function json(response: Response, status: number) {
  const result = await response.json(); assert.equal(response.status, status, JSON.stringify(result)); remember(response); return result;
}
function mp4(seconds = 15) {
  function box(type: string, contents: Buffer) { const bytes = Buffer.alloc(contents.length + 8); bytes.writeUInt32BE(bytes.length); bytes.write(type, 4); contents.copy(bytes, 8); return bytes; }
  const movie = Buffer.alloc(20); movie.writeUInt32BE(1000, 12); movie.writeUInt32BE(seconds * 1000, 16);
  return Buffer.concat([box('ftyp', Buffer.from('isom0000')), box('moov', box('mvhd', movie))]);
}
const steps = { do: async (_name: string, fn: any) => fn(), sleep: async () => {} };
const fetchOutput = async (input: string | URL | Request) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.origin, base, 'The integration flow must never call an external service.');
  assert(url.pathname.startsWith('/files/'));
  const key = url.pathname.slice('/files/'.length);
  return isSiteMedia(key) ? serveSiteMedia(new Request(url), key) : jobsApi.file(new Request(url), key);
};

test('Shipwords API flow: auth �� uploads �� original job lifecycle �� result / refund', async t => {
  let userId: string; let left: string; let right: string; let motion: string;
  const reference = mp4();
  await t.test('current packs keep prices and provide 1, 3 and 8 videos; old entitlements remain server-side', async () => {
    assert.deepEqual(site.products.map(product => product.price.amount), [999, 2499, 4999]);
    assert.deepEqual(site.products.map(product => product.kind === 'credits' ? product.credits / models[0].credits : null), [1, 3, 8]);
    assert.equal(site.products.some(product => product.id === 'starter'), false);
    const legacy = core.site.products.find(product => product.id === 'starter');
    assert(legacy?.kind === 'credits');
    assert.equal(legacy.credits, 30);
    assert.equal(new Set(core.site.products.map(product => product.id)).size, core.site.products.length);
  });
  await t.test('public config and auth work without payment credentials; billing still requires them', async () => {
    assert.equal(env.STRIPE_SECRET_KEY, undefined);
    assert.equal(env.STRIPE_WEBHOOK_SECRET, undefined);
    const unpaid = createCore(site);
    assert.equal(unpaid.env.APP_URL, base);
    await json(await unpaid.handleAuth(request('/api/auth/get-session', undefined, {}, false)), 200);
    await assert.rejects(
      unpaid.billing.webhook(request('/api/webhooks/stripe', {})),
      /missing env STRIPE_SECRET_KEY/,
    );
    env.STRIPE_SECRET_KEY = 'sk_test_local_integration';
    try {
      await assert.rejects(
        unpaid.billing.webhook(request('/api/webhooks/stripe', {})),
        /missing env STRIPE_WEBHOOK_SECRET/,
      );
    } finally {
      delete env.STRIPE_SECRET_KEY;
    }
  });
  await t.test('new checkout rejects retired packs while preserving authentication for current packs', async () => {
    env.STRIPE_SECRET_KEY = 'rk_live_local_fixture';
    try {
      const retired = await json(await checkout(request('/api/billing/checkout', { productId: 'starter' }, {}, false)), 400);
      assert.equal(retired.error.code, 'pack_changed');
      for (const product of site.products) {
        await json(await checkout(request('/api/billing/checkout', { productId: product.id }, {}, false)), 401);
      }
      assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM orders').get()?.count, 0);
    } finally { delete env.STRIPE_SECRET_KEY; }
  });
  await t.test('email OTP signs in without granting free generation credits', async () => {
    await json(await core.handleAuth(request('/api/auth/email-otp/send-verification-otp', { email: 'mami-flow@example.org', type: 'sign-in' })), 200);
    assert.equal(emails.length, 1);
    const otp = emails[0].text.match(/\b\d{6}\b/)[0];
    const result = await json(await core.handleAuth(request('/api/auth/sign-in/email-otp', { email: 'mami-flow@example.org', otp })), 200);
    userId = result.user.id;
    assert.equal((await core.getUser(request('/api/auth/get-session')))?.id, userId);
    assert.equal((await getBalance(core.db, userId)).available, 0);
  });
  await t.test('photos upload normally while visitors cannot upload or replace reference videos', async () => {
    const portrait = fs.readFileSync('public/mock-output.png');
    left = (await json(await jobsApi.upload(request('/api/uploads', portrait, { 'content-type': 'image/png' })), 201)).path;
    right = (await json(await jobsApi.upload(request('/api/uploads', portrait, { 'content-type': 'image/png' })), 201)).path;
    const count = bucket.objects.size;
    await json(await uploadMotion(request('/api/motion-reference', reference, { 'content-type': 'video/mp4' })), 405);
    assert.equal(bucket.objects.size, count);
    assert.equal((await siteMedia()).reference, null);
    await bucket.put(SITE_MEDIA.reference, reference, { httpMetadata: { contentType: 'video/mp4' } });
    await bucket.put(SITE_MEDIA.example, mp4(8), { httpMetadata: { contentType: 'video/mp4' } });
    const media = await siteMedia();
    motion = media.reference!.url;
    assert.equal(media.reference!.duration, 15);
    assert(media.example!.url.includes('example.mp4'));
    assert.notEqual(media.example!.url, motion);
  });
  await t.test('operator videos support byte ranges, HEAD and ETag revalidation', async () => {
    const range = await serveSiteMedia(new Request(base + motion, { headers: { range: 'bytes=0-7' } }), SITE_MEDIA.reference);
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-range'), `bytes 0-7/${reference.length}`);
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), reference.subarray(0, 8));
    const suffix = await serveSiteMedia(new Request(base + motion, { headers: { range: 'bytes=-4' } }), SITE_MEDIA.reference);
    assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), reference.subarray(-4));
    const head = await serveSiteMedia(new Request(base + motion, { method: 'HEAD' }), SITE_MEDIA.reference);
    assert.equal(head.status, 200); assert.equal(await head.text(), '');
    const cached = await serveSiteMedia(new Request(base + motion, { headers: { 'if-none-match': head.headers.get('etag')! } }), SITE_MEDIA.reference);
    assert.equal(cached.status, 304);
    assert.equal((await serveSiteMedia(new Request(base + motion, { headers: { range: 'bytes=9999-' } }), SITE_MEDIA.reference)).status, 416);
    assert.equal((await serveSiteMedia(new Request(base + motion), 'assets/secret.mp4')).status, 404);
  });
  await t.test('legacy free credits, pending payments, refunds and another user payment cannot bypass purchase', async () => {
    await grantCredits(core.db, { userId, amount: 20, source: 'signup', idemKey: 'legacy-signup-test' });
    const blocked = async () => {
      const result = await json(await createDance(request('/api/jobs', { modelId: models[0].id, motion, slots: { left } })), 402);
      assert.equal(result.error.code, 'payment_required');
      assert.equal((await getBalance(core.db, userId)).available, 20);
      assert.equal(dispatched.length, 0);
      assert.equal(db.sqlite.prepare('SELECT COUNT(*) AS count FROM jobs').get()?.count, 0);
    };
    await blocked();
    const fixture = { userId, provider: 'stripe', productId: 'starter', currency: 'usd', amount: 999 };
    await core.db.insert(payments).values([
      { ...fixture, id: 'pay_pending', paymentRef: 'pending' },
      { ...fixture, id: 'pay_refunded', paymentRef: 'refunded', amountRefunded: 999, creditsGranted: 30 },
      { ...fixture, id: 'pay_revoked', paymentRef: 'revoked', creditsGranted: 30, creditsRevoked: 30 },
      { ...fixture, id: 'pay_other', paymentRef: 'other', userId: 'another-user', creditsGranted: 30 },
    ]);
    await blocked();
    await core.db.insert(payments).values({ ...fixture, id: 'pay_settled', paymentRef: 'settled', creditsGranted: 30 });
  });
  await t.test('missing or invalid operator reference rejects generation before charging', async () => {
    const balance = (await getBalance(core.db, userId)).available;
    await bucket.delete(SITE_MEDIA.reference);
    assert.equal((await createDance(request('/api/jobs', { modelId: models[0].id, slots: { left } }))).status, 503);
    await bucket.put(SITE_MEDIA.reference, mp4(21));
    assert.equal((await createDance(request('/api/jobs', { modelId: models[0].id, slots: { left } }))).status, 503);
    assert.equal((await getBalance(core.db, userId)).available, balance);
    assert.equal(dispatched.length, 0);
    await bucket.put(SITE_MEDIA.reference, reference, { httpMetadata: { contentType: 'video/mp4' } });
    const updated = await fixedReference();
    assert.notEqual(updated!.url, motion);
    motion = updated!.url;
  });
  await t.test('invalid origins and anonymous generation are rejected before charging', async () => {
    assert.equal((await createDance(request('/api/jobs', { modelId: models[0].id, slots: { left } }, { origin: 'https://unrelated.invalid' }))).status, 403);
    assert.equal((await createDance(request('/api/jobs', { modelId: 'unknown', slots: { left } }))).status, 400);
    assert.equal((await createDance(request('/api/jobs', { modelId: models[0].id, slots: { left } }, {}, false))).status, 401);
    assert.equal((await getBalance(core.db, userId)).available, 20);
  });
  async function create(slots: Record<string, string>) {
    return (await json(await createDance(request('/api/jobs', { modelId: models[0].id, motion: 'https://attacker.invalid/override.mp4', slots })), 201)).job;
  }
  await t.test('duo submission passes one video and two photos to the provider and returns a downloadable mock result', async () => {
    const job = await create({ left, right });
    assert(dispatched.includes(job.id));
    assert.equal((await getBalance(core.db, userId)).available, 10);
    const submitted: any[] = [];
    const mock = new MockAdapter('succeed', { image: 0, video: 0 });
    const adapter = { name: 'test-mock', submit: async (input: any, key: string) => { submitted.push(input); return mock.submit(input); }, poll: (id: string) => mock.poll(id), cancel: () => mock.cancel() };
    await runGeneration({ db: core.db, bucket: bucket as any, models, adapters: { yir: adapter }, fetcher: fetchOutput as typeof fetch }, job.id, steps);
    assert.equal(submitted.length, 1);
    assert.deepEqual(submitted[0].references.map((ref: any) => ref.role), ['reference_video', 'reference_image', 'reference_image']);
    assert.equal(submitted[0].references[0].url, base + motion);
    assert.equal(submitted[0].parameters.duration, 15);
    assert(!submitted[0].references[0].url.includes('attacker.invalid'));
    assert(submitted[0].prompt.includes('@video_1') && submitted[0].prompt.includes('@image_1') && submitted[0].prompt.includes('@image_2'));
    const upstream = buildYirRequest(submitted[0]);
    assert.equal(upstream.input.type, 'reference');
    assert.equal((upstream.input as any).references[0].role, 'reference_video');
    const result = await json(await jobsApi.get(request('/api/jobs/' + job.id), job.id), 200);
    assert.equal(result.job.status, 'succeeded');
    const download = new URL(result.job.outputs[0].url);
    const response = await jobsApi.file(request(download.pathname), download.pathname.slice(7));
    assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'video/mp4');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), reference);
    assert.equal((await jobsApi.get(request('/api/jobs/' + job.id, undefined, {}, false), job.id)).status, 404);
    assert.equal((await getBalance(core.db, userId)).available, 10);
  });
  await t.test('cancel returns credits once and terminates the existing workflow', async () => {
    const job = await create({ left });
    assert.equal((await getBalance(core.db, userId)).available, 0);
    const dispatchCount = dispatched.length;
    const insufficient = await json(await createDance(request('/api/jobs', { modelId: models[0].id, motion, slots: { left } })), 402);
    assert.equal(insufficient.error.code, 'insufficient_credits');
    assert.equal(dispatched.length, dispatchCount);
    const result = await json(await jobsApi.cancel(request('/api/jobs/' + job.id + '/cancel', {}), job.id), 200);
    assert.equal(result.job.status, 'canceled'); assert(terminated.includes(job.id));
    assert.equal((await getBalance(core.db, userId)).available, 10);
    await jobsApi.cancel(request('/api/jobs/' + job.id + '/cancel', {}), job.id);
    assert.equal((await getBalance(core.db, userId)).available, 10);
  });
  await t.test('provider failure refunds once, including a repeated workflow run', async () => {
    const job = await create({ left });
    const deps = { db: core.db, bucket: bucket as any, models, adapters: { yir: new MockAdapter('fail', { image: 0, video: 0 }) }, fetcher: fetchOutput as typeof fetch };
    await runGeneration(deps, job.id, steps);
    const result = await json(await jobsApi.get(request('/api/jobs/' + job.id), job.id), 200);
    assert.equal(result.job.status, 'failed');
    assert.equal((await getBalance(core.db, userId)).available, 10);
    await runGeneration(deps, job.id, steps);
    assert.equal((await getBalance(core.db, userId)).available, 10);
  });
  await t.test('scene controls show only the selected inputs and keep visitor copy in English', () => {
    for (const mode of ['original', 'description', 'photo'] as SceneMode[]) {
      const html = renderToStaticMarkup(createElement(SceneControls, {
        mode, description: '', background: '', disabled: false, uploading: false,
        onMode() {}, onDescription() {}, onUpload() {}, onRemove() {},
      }));
      assert.equal((html.match(/type="radio"/g) ?? []).length, 3);
      assert.equal(html.includes('<textarea'), mode !== 'original');
      assert.equal(html.includes('type="file"'), mode === 'photo');
      assert.equal(/<textarea[^>]* required=""/.test(html), mode === 'description');
      assert(!/[\u3400-\u9fff]/.test(html), 'English site controls must not contain Chinese copy.');
    }
  });
  await t.test('invalid scenes and arbitrary background URLs fail without credits or jobs', async () => {
    const balance = (await getBalance(core.db, userId)).available;
    const count = dispatched.length;
    for (const scene of [null, [], { mode: 'unknown' }, { mode: 'description', description: '  ' },
      { mode: 'description', description: 'x'.repeat(SCENE_DESCRIPTION_LIMIT + 1) },
      { mode: 'description', description: { prompt: 'wrong type' } },
      { mode: 'description', description: 'a\u0000room' }]) {
      const response = await json(await createDance(request('/api/jobs', { modelId: models[0].id, slots: { left }, scene })), 400);
      assert.equal(response.error.code, 'invalid_scene');
    }
    const missing = await json(await createDance(request('/api/jobs', { modelId: models[0].id, slots: { left }, scene: { mode: 'photo' } })), 400);
    assert.equal(missing.error.code, 'background_required');
    for (const background of ['https://attacker.invalid/photo.png', '/files/assets/secret.png', '/files/uploads/../secret.png']) {
      const response = await json(await createDance(request('/api/jobs', { modelId: models[0].id, slots: { left, background }, scene: { mode: 'photo' } })), 400);
      assert.equal(response.error.code, 'invalid_slots');
    }
    assert.equal((await getBalance(core.db, userId)).available, balance);
    assert.equal(dispatched.length, count);
  });
  await t.test('custom scenes snapshot the selected prompt and correctly numbered background references into real jobs', async () => {
    const background = (await json(await jobsApi.upload(request('/api/uploads', fs.readFileSync('public/mock-output.png'), { 'content-type': 'image/png' })), 201)).path;
    await grantCredits(core.db, { userId, amount: 30, source: 'purchase', idemKey: 'scene-flow-credit-fixture' });
    const cases = [
      { scene: { mode: 'description', description: 'A sunlit rooftop in San Juan.' }, slots: { left, background }, refs: 2, image: null },
      { scene: { mode: 'photo', description: '' }, slots: { left, background }, refs: 3, image: '@image_2' },
      { scene: { mode: 'photo', description: 'Warm evening light.' }, slots: { left, right, background }, refs: 4, image: '@image_3' },
    ];
    for (const scenario of cases) {
      const before = (await getBalance(core.db, userId)).available;
      const response = await json(await createDance(request('/api/jobs', {
        modelId: models[0].id, ...scenario, motion: 'https://attacker.invalid/override.mp4',
        prompt: 'OVERRIDE_FIXED_DANCE', parameters: { duration: 1, credits: 0 },
      })), 201);
      const row = db.sqlite.prepare('SELECT input_json FROM jobs WHERE id = ?').get(response.job.id) as { input_json: string };
      const stored = JSON.parse(row.input_json).parts[0];
      assert.equal(stored.references.length, scenario.refs);
      assert(!stored.prompt.includes('Keep the original environment'));
      assert(!stored.prompt.includes('OVERRIDE_FIXED_DANCE'));
      assert.equal(stored.parameters.duration, 15);
      assert.equal((await getBalance(core.db, userId)).available, before - 10);
      assert.equal(response.job.prompt, '', 'Internal prompts stay private.');
      const submitted: any[] = [];
      const mock = new MockAdapter('succeed', { image: 0, video: 0 });
      const adapter = { name: 'scene-mock', submit: async (input: any) => { submitted.push(input); return mock.submit(input); }, poll: (id: string) => mock.poll(id), cancel: () => mock.cancel() };
      // The worker uses the static catalog; scene changes must already exist in the job snapshot.
      await runGeneration({ db: core.db, bucket: bucket as any, models, adapters: { yir: adapter }, fetcher: fetchOutput as typeof fetch }, response.job.id, steps);
      assert.equal(submitted.length, 1);
      const payload = buildYirRequest(submitted[0]);
      assert.equal(payload.input.type, 'reference');
      assert.equal(submitted[0].references[0].role, 'reference_video');
      assert.equal(submitted[0].references[0].url, base + motion);
      assert(submitted[0].prompt.includes('Keep the reference audio'));
      if (scenario.image) {
        assert(submitted[0].prompt.includes(`setting shown in ${scenario.image}`));
        assert.equal(submitted[0].references.at(-1).url, base + background);
        assert.equal(submitted[0].references.at(-1).role, 'reference_image');
        assert(submitted[0].prompt.includes('do not copy its people'));
      } else {
        assert(submitted[0].prompt.includes('A sunlit rooftop in San Juan.'));
        assert(!submitted[0].references.some((ref: any) => ref.url === base + background), 'Text scenes ignore a stale background upload.');
      }
      const result = await json(await jobsApi.get(request('/api/jobs/' + response.job.id), response.job.id), 200);
      assert.equal(result.job.status, 'succeeded');
    }
    const before = (await getBalance(core.db, userId)).available;
    const original = await json(await createDance(request('/api/jobs', {
      modelId: models[0].id, slots: { left, background }, scene: { mode: 'original', description: 'Ignore this stale setting.' },
    })), 201);
    const row = db.sqlite.prepare('SELECT input_json FROM jobs WHERE id = ?').get(original.job.id) as { input_json: string };
    const part = JSON.parse(row.input_json).parts[0];
    assert(part.prompt.includes('Keep the original environment'));
    assert(!part.prompt.includes('stale setting'));
    assert.equal(part.references.length, 2);
    await jobsApi.cancel(request('/api/jobs/' + original.job.id + '/cancel', {}), original.job.id);
    assert.equal((await getBalance(core.db, userId)).available, before);
  });
  db.sqlite.close();
});
