import { createFileRoute } from '@tanstack/react-router';
import { uploadMotion } from '~/site/motion.server';
export const Route = createFileRoute('/api/motion-reference')({
  server: { handlers: { POST: ({ request }) => uploadMotion(request) } },
});
