import { createFileRoute } from '@tanstack/react-router';
import { jobsApi } from '~/core.server';
import { isSiteMedia } from '~/site/media';
import { serveSiteMedia } from '~/site/media.server';
async function file(request: Request, key: string) {
  if (isSiteMedia(key)) return serveSiteMedia(request, key);
  const response = await jobsApi.file(request, key);
  return request.method === 'HEAD' ? new Response(null, { status: response.status, headers: response.headers }) : response;
}
export const Route = createFileRoute('/files/$')({
  server: { handlers: {
    GET: ({ request, params }) => file(request, params._splat ?? ''),
    HEAD: ({ request, params }) => file(request, params._splat ?? ''),
  } },
});
