import { llmsTxt } from '@shipwords/core/seo';
import { createFileRoute } from '@tanstack/react-router';
import site from '../../site.config';

export const Route = createFileRoute('/llms.txt')({
  server: {
    handlers: {
      GET: () =>
        llmsTxt(site, 'An independent Puerto Rican Mami AI dance video tool. Personal photos supply appearance and a user-provided MP4 guides motion. Local mock mode replays the input without AI generation.', [
          { title: 'Puerto Rican Mami AI', path: '/', description: 'Add one or two adult portraits and a 2–20 second reference MP4 to create a dance video. Real generation needs a configured provider.' },
          { title: 'Credit packs', path: '/#pricing', description: 'One-time credit packs; 10 credits per job. Checkout is unavailable before launch.' },
          { title: 'Questions and answers', path: '/#faq', description: 'Photo requirements, reference guidance, solo/duo mapping and limitations.' },
        ]),
    },
  },
});
