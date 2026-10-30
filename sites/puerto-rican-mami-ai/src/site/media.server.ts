import { core } from '~/core.server';
import { isSiteMedia, mediaUrl, SITE_MEDIA } from './media';
import { MAX_MOTION_BYTES, mp4Duration } from './motion-rules';
const bucket = () => (core.env as unknown as { OUTPUTS: R2Bucket }).OUTPUTS;
let referenceCache: { etag: string; duration: Promise<number | null> } | undefined;
export async function fixedReference() {
  const object = await bucket().head(SITE_MEDIA.reference);
  if (!object || object.size > MAX_MOTION_BYTES || object.size < 16) return null;
  if (referenceCache?.etag !== object.httpEtag) {
    const duration = (async () => {
      const video = await bucket().get(SITE_MEDIA.reference, { onlyIf: { etagMatches: object.etag } });
      if (!video || !('body' in video)) return null;
      return mp4Duration(new Uint8Array(await video.arrayBuffer()));
    })();
    referenceCache = { etag: object.httpEtag, duration };
    duration.catch(() => { if (referenceCache?.duration === duration) referenceCache = undefined; });
  }
  const duration = await referenceCache.duration;
  if (!duration) return null;
  const url = mediaUrl(SITE_MEDIA.reference, object.httpEtag);
  return { url, duration, key: url.slice('/files/'.length) };
}
export async function siteMedia() {
  const [reference, example] = await Promise.all([fixedReference(), bucket().head(SITE_MEDIA.example)]);
  return {
    reference: reference ? { url: reference.url, duration: reference.duration } : null,
    example: example && example.size > 0 ? { url: mediaUrl(SITE_MEDIA.example, example.httpEtag) } : null,
  };
}
/** Serve only the operator's two videos, with seeking and cache revalidation. */
export async function serveSiteMedia(request: Request, key: string): Promise<Response> {
  if (!isSiteMedia(key)) return new Response('Not found', { status: 404 });
  const object = await bucket().head(key);
  if (!object) return new Response('Not found', { status: 404 });
  const headers = new Headers({
    'content-type': 'video/mp4', 'content-length': String(object.size),
    'accept-ranges': 'bytes', etag: object.httpEtag,
    'cache-control': 'public, max-age=0, must-revalidate', 'x-content-type-options': 'nosniff',
  });
  const tags = request.headers.get('if-none-match')?.split(',').map(tag => tag.trim());
  if (tags?.includes(object.httpEtag) || tags?.includes('*')) {
    headers.delete('content-length');
    return new Response(null, { status: 304, headers });
  }
  let range: { offset: number; length: number } | undefined;
  const raw = request.headers.get('range');
  const ifRange = request.headers.get('if-range');
  if (raw && (!ifRange || ifRange === object.httpEtag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(raw);
    const suffix = match && !match[1] ? Number(match[2]) : null;
    const start = suffix !== null ? Math.max(0, object.size - suffix) : Number(match?.[1]);
    const end = suffix !== null || !match?.[2] ? object.size - 1 : Math.min(object.size - 1, Number(match[2]));
    if (!match || (!match[1] && !match[2]) || suffix === 0 || !Number.isSafeInteger(start) || start < 0 || start >= object.size || end < start) {
      headers.set('content-range', `bytes */${object.size}`); headers.set('content-length', '0');
      return new Response(null, { status: 416, headers });
    }
    range = { offset: start, length: end - start + 1 };
    headers.set('content-range', `bytes ${start}-${end}/${object.size}`);
    headers.set('content-length', String(range.length));
  }
  if (request.method === 'HEAD') return new Response(null, { status: range ? 206 : 200, headers });
  const video = await bucket().get(key, { ...(range ? { range } : {}), onlyIf: { etagMatches: object.etag } });
  if (!video || !('body' in video)) return new Response('Video changed; retry', { status: 409, headers: { 'cache-control': 'no-store' } });
  return new Response(video.body, { status: range ? 206 : 200, headers });
}
