import { createFileRoute } from '@tanstack/react-router';
import { jobsApi } from '~/core.server';
import { createDance } from '~/site/motion.server';

export const Route = createFileRoute('/api/jobs/')({
  server: {
    handlers: {
      GET: ({ request }) => jobsApi.list(request),
      POST: ({ request }) => createDance(request),
    },
  },
});
