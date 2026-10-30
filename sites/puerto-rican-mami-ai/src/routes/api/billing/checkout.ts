import { createFileRoute } from '@tanstack/react-router';
import { checkout } from '~/site/checkout.server';

export const Route = createFileRoute('/api/billing/checkout')({
  server: { handlers: { POST: ({ request }) => checkout(request) } },
});
