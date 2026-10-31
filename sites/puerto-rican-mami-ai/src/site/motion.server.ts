import { errorResponse, readJson } from '@shipwords/core/http';
import { createJobs } from '@shipwords/jobs/handlers';
import type { ModelDefinition } from '@shipwords/jobs/models';
import { core } from '~/core.server';
import models from '../../site.models';
import { fixedReference } from './media.server';
import { dancePrompt, parseScene } from './scene';

function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(core.env.APP_URL ?? core.site.url).origin;
}
/** Retired visitor upload endpoint: only the operator manages reference videos in R2. */
export async function uploadMotion(_request: Request) {
  return errorResponse(405, 'fixed_reference', 'This site uses a fixed dance reference. Refresh the page.');
}
/** Validate site inputs; shared auth, credits and job lifecycle own the submission. */
export async function createDance(request: Request) {
  if (!sameOrigin(request)) return errorResponse(403, 'invalid_origin');
  const body = await readJson<{ modelId?: string; slots?: Record<string, unknown>; scene?: unknown; recaptchaToken?: string }>(request);
  if (!body || body.modelId !== models[0].id) return errorResponse(400, 'unknown_model');
  const user = await core.getUser(request);
  if (!user) return errorResponse(401, 'login_required', 'Sign in before generating a video.');
  const scene = parseScene(body.scene);
  if (!scene) return errorResponse(400, 'invalid_scene', 'Choose a scene and enter up to 600 characters of scene details.');
  if (!body.slots || typeof body.slots !== 'object' || Array.isArray(body.slots) ||
    Object.keys(body.slots).some(key => !['left', 'right', 'background'].includes(key)))
    return errorResponse(400, 'invalid_slots', 'Add the selected dancer photos first.');
  if (scene.mode === 'photo' && !body.slots.background)
    return errorResponse(400, 'background_required', 'Upload a background photo for this scene.');
  // Hidden or stale background uploads cannot influence original/text scenes.
  const { background, ...dancers } = body.slots;
  const slots = scene.mode === 'photo' ? { ...dancers, background } : dancers;
  // Existing promotional credits must not let an unpaid account submit a paid generation.
  // These records are created by the shared, verified payment reconciliation flow.
  const payment = await core.db.query.payments.findFirst({
    columns: { id: true },
    where: (row, { and, eq, gt }) => and(
      eq(row.userId, user.id),
      gt(row.amount, row.amountRefunded),
      gt(row.creditsGranted, row.creditsRevoked),
    ),
  });
  if (!payment)
    return errorResponse(402, 'payment_required', 'Purchase a credit pack before generating a video.');
  const reference = await fixedReference();
  if (!reference) return errorResponse(503, 'reference_not_ready', 'The dance reference is being prepared. Please try again later.');
  const seconds = reference.duration;
  const model = models[0];
  // The client cannot override the reference. Keys work with both HTTP local tests and HTTPS production.
  const clipKey = reference.key;
  const resolved: ModelDefinition = { ...model, effect: {
    ...model.effect,
    slots: [...model.effect.slots, ...(scene.mode === 'photo' ? [{ id: 'background', label: 'Background scene', required: true }] : [])],
    segments: model.effect.segments.map(segment => ({
      ...segment, referenceVideo: clipKey,
      slots: [...segment.slots, ...(scene.mode === 'photo' ? ['background'] : [])],
      prompt: images => dancePrompt(scene, images),
      parameters: { ...segment.parameters, duration: Math.min(20, Math.ceil(seconds)) },
    })),
  }};
  const next = new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({
    modelId: model.id, slots, recaptchaToken: body.recaptchaToken,
  }) });
  return createJobs(core, [resolved]).create(next);
}
