import { clientIp, errorResponse, ipBucket, json, readJson } from '@shipwords/core/http';
import { consumeQuota, dayWindow } from '@shipwords/core/quota/counters';
import { ensureGuestId, readGuestId } from '@shipwords/core/quota/guest';
import { createJobs } from '@shipwords/jobs/handlers';
import type { ModelDefinition } from '@shipwords/jobs/models';
import { core } from '~/core.server';
import models from '../../site.models';
import { MAX_MOTION_BYTES, MOTION_PATH, mp4Duration } from './motion-rules';

const bucket = () => (core.env as unknown as { OUTPUTS: R2Bucket }).OUTPUTS;

function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(core.env.APP_URL ?? core.site.url).origin;
}
async function boundedBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return null;
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  for (;;) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_MOTION_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let at = 0;
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength; }
  return bytes;
}
export async function uploadMotion(request: Request) {
  if (!sameOrigin(request)) return errorResponse(403, 'invalid_origin', 'Please upload from this site.');
  if (request.headers.get('content-type')?.split(';')[0] !== 'video/mp4')
    return errorResponse(415, 'invalid_video', 'Use an MP4 video.');
  if (Number(request.headers.get('content-length')) > MAX_MOTION_BYTES)
    return errorResponse(413, 'too_large', 'The reference video must be 30 MB or smaller.');
  const { guestId, setCookie } = await ensureGuestId(request.headers, core.site.id, core.env.GUEST_COOKIE_SECRET);
  const ip = clientIp(request.headers); const window = dayWindow();
  const ok = await consumeQuota(core.db, [
    { key: `motion:device:${guestId}`, window, limit: 10 },
    ...(ip ? [{ key: `motion:ip:${ipBucket(ip)}`, window, limit: 20 }] : []),
    { key: 'motion:site', window, limit: 200 },
  ]);
  if (!ok) return errorResponse(429, 'upload_limit', 'Reference upload limit reached. Try again tomorrow.');
  const bytes = await boundedBody(request);
  if (!bytes) return errorResponse(413, 'too_large', 'The reference video must be 30 MB or smaller.');
  const duration = mp4Duration(bytes);
  if (!duration) return errorResponse(400, 'invalid_video', 'Use a readable MP4 between 2 and 20 seconds long.');
  const user = await core.getUser(request);
  const key = `assets/motion/${crypto.randomUUID().replaceAll('-', '')}.mp4`;
  await bucket().put(key, bytes, {
    httpMetadata: { contentType: 'video/mp4' },
    customMetadata: { guestId, userId: user?.id ?? '', duration: String(duration), uploadedAt: String(Date.now()) },
  });
  return json({ path: `/files/${key}`, duration }, { headers: setCookie ? { 'set-cookie': setCookie } : {} });
}
/** Validate site inputs; shared auth, credits and job lifecycle own the submission. */
export async function createDance(request: Request) {
  if (!sameOrigin(request)) return errorResponse(403, 'invalid_origin');
  const body = await readJson<{ modelId?: string; motion?: unknown; slots?: Record<string, unknown>; recaptchaToken?: string }>(request);
  if (!body || body.modelId !== models[0].id || typeof body.motion !== 'string' || !MOTION_PATH.test(body.motion))
    return errorResponse(400, 'reference_required', 'Add a dance reference MP4 first.');
  const object = await bucket().head(body.motion.slice('/files/'.length));
  const [user, guestId] = await Promise.all([
    core.getUser(request), readGuestId(request.headers, core.site.id, core.env.GUEST_COOKIE_SECRET),
  ]);
  const owner = object?.customMetadata;
  if (!object || !owner || !((user && owner.userId === user.id) || (guestId && owner.guestId === guestId)))
    return errorResponse(403, 'reference_unavailable', 'Upload your reference again in this browser.');
  const seconds = Number(owner.duration);
  if (!(seconds >= 2 && seconds <= 20.05)) return errorResponse(400, 'invalid_duration');
  const model = models[0];
  // Pass the validated R2 key. Shared effectParts resolves it against APP_URL for both
  // local HTTP and production HTTPS; a full HTTP URL would otherwise be treated as a key.
  const clipKey = body.motion.slice('/files/'.length);
  const resolved: ModelDefinition = { ...model, effect: {
    ...model.effect,
    segments: model.effect.segments.map(segment => ({
      ...segment, referenceVideo: clipKey, parameters: { ...segment.parameters, duration: Math.min(20, Math.ceil(seconds)) },
    })),
  }};
  const next = new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({
    modelId: model.id, slots: body.slots, recaptchaToken: body.recaptchaToken,
  }) });
  return createJobs(core, [resolved]).create(next);
}
