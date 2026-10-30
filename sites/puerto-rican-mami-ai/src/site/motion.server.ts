import { errorResponse, readJson } from '@shipwords/core/http';
import { createJobs } from '@shipwords/jobs/handlers';
import type { ModelDefinition } from '@shipwords/jobs/models';
import { core } from '~/core.server';
import models from '../../site.models';
import { fixedReference } from './media.server';

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
  const body = await readJson<{ modelId?: string; slots?: Record<string, unknown>; recaptchaToken?: string }>(request);
  if (!body || body.modelId !== models[0].id) return errorResponse(400, 'unknown_model');
  const user = await core.getUser(request);
  if (!user) return errorResponse(401, 'login_required', 'Sign in before generating a video.');
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
    segments: model.effect.segments.map(segment => ({
      ...segment, referenceVideo: clipKey, parameters: { ...segment.parameters, duration: Math.min(20, Math.ceil(seconds)) },
    })),
  }};
  const next = new Request(request.url, { method: 'POST', headers: request.headers, body: JSON.stringify({
    modelId: model.id, slots: body.slots, recaptchaToken: body.recaptchaToken,
  }) });
  return createJobs(core, [resolved]).create(next);
}
