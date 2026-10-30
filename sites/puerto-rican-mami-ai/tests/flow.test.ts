import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { getBalance } from '@shipwords/core/credits/ledger';
import { MockAdapter } from '@shipwords/jobs/mock';
import { runGeneration } from '@shipwords/jobs/runner';
import { buildYirRequest } from '@shipwords/jobs/yir';
import { core, jobsApi } from '../src/core.server';
import { createDance, uploadMotion } from '../src/site/motion.server';
import models from '../site.models';
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
  STRIPE_SECRET_KEY: 'sk_test_local_integration', STRIPE_WEBHOOK_SECRET: 'whsec_local_integration',
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
  return jobsApi.file(new Request(url), url.pathname.slice('/files/'.length));
};

test('Shipwords API flow: auth → uploads → original job lifecycle → result / refund', async t => {
  let userId: string; let left: string; let right: string; let motion: string;
  const reference = mp4();
  await t.test('email OTP signs in and grants the existing signup bonus', async () => {
    await json(await core.handleAuth(request('/api/auth/email-otp/send-verification-otp', { email: 'mami-flow@example.org', type: 'sign-in' })), 200);
    assert.equal(emails.length, 1);
    const otp = emails[0].text.match(/\b\d{6}\b/)[0];
    const result = await json(await core.handleAuth(request('/api/auth/sign-in/email-otp', { email: 'mami-flow@example.org', otp })), 200);
    userId = result.user.id;
    assert.equal((await core.getUser(request('/api/auth/get-session')))?.id, userId);
    assert.equal((await getBalance(core.db, userId)).available, 20);
  });
  await t.test('real photo handler and site reference handler accept media and record ownership', async () => {
    const portrait = fs.readFileSync('public/mock-output.png');
    left = (await json(await jobsApi.upload(request('/api/uploads', portrait, { 'content-type': 'image/png' })), 201)).path;
    right = (await json(await jobsApi.upload(request('/api/uploads', portrait, { 'content-type': 'image/png' })), 201)).path;
    const uploaded = await json(await uploadMotion(request('/api/motion-reference', reference, { 'content-type': 'video/mp4' })), 200);
    motion = uploaded.path;
    assert.equal(uploaded.duration, 15);
    assert.equal((await bucket.head(motion.slice(7)))?.customMetadata.userId, userId);
  });
  await t.test('invalid origins, overlong clips, missing reference and another browser are rejected before charging', async () => {
    assert.equal((await uploadMotion(request('/api/motion-reference', reference, { origin: 'https://unrelated.invalid', 'content-type': 'video/mp4' }))).status, 403);
    assert.equal((await uploadMotion(request('/api/motion-reference', mp4(21), { 'content-type': 'video/mp4' }))).status, 400);
    assert.equal((await createDance(request('/api/jobs', { modelId: models[0].id, slots: { left } }))).status, 400);
    assert.equal((await createDance(request('/api/jobs', { modelId: models[0].id, motion, slots: { left } }, {}, false))).status, 403);
    assert.equal((await getBalance(core.db, userId)).available, 20);
  });
  async function create(slots: Record<string, string>) {
    return (await json(await createDance(request('/api/jobs', { modelId: models[0].id, motion, slots })), 201)).job;
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
  db.sqlite.close();
});
