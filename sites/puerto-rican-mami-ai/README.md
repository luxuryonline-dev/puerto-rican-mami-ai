# Puerto Rican Mami AI

- Target keyword: puerto rican mami ai; secondary: puerto rican mami dance ai, AI duo dance.
- Search intent: use personal photos and a motion reference to create a dance video.
- Domain: puertoricanmamiai.com.
- Status: local development; mock upstream. Real paid generations and checkout need launch validation.
- API integration verified: email OTP, signup credits, image/video uploads, owned-reference checks, correct Yir reference payload, successful mock delivery, cancellation refund and failure refund. Repeated settlement does not return credits twice.
- Competitors: AI Dance, MakeViral and Jump on the Trend's Puerto Rican Mami pages.
- Difference: explicit reference-video input, clear left/right photo mapping and transparent mock-result labeling. No prompt writing required.

## Local development
Node 24, pnpm 10. Run pnpm install at the root, then pnpm setup:worktree. Keep local secrets outside the repository (SHIPWORDS_SECRETS), UPSTREAM_MOCK=1 and test payment credentials. In this site run pnpm db:generate, pnpm db:migrate:local and pnpm dev. Sign-in codes print to the terminal. The mock returns the reference unchanged, with no AI generation.

## Reference pipeline
Visitors upload a 2–20 second H.264 MP4, up to 30 MB. The server validates an MP4 header, records ownership and duration in R2, and accepts only owned reference paths. The trusted prompt and model are set server-side. Video uses reference_video; photos use reference_image. Shared credits, auth and workflow are unchanged.

One photo replaces the dancer initially on the left; two replace both initial positions, following identities through crossings. The real Yir/Kling edit path needs an end-to-end paid test before launch. Exact timing, audio, identity quality and actual cost are unverified.

## Verification

Run `pnpm test` in this site. The flow test bundles and calls the actual Shipwords auth, credit, job and runner code. Test-only SQLite/R2/Email bindings live in `tests/support/`; Workflow steps run directly with a zero-delay mock adapter. No network listener, external email, provider call or real payment is involved. This validates API integration, not Cloudflare runtime behavior or browser interaction.

The owned MP4 is passed to the shared effect resolver as its R2 key, so both local HTTP and production HTTPS URLs are constructed correctly. Passing a full local HTTP URL would incorrectly produce a double-prefixed file address; the flow test covers that regression.

## Launch
Verify the puertoricanmamiai.com custom domain, support@puertoricanmamiai.com inbox, D1 ID, R2, email, upstream and payment keys/products/webhooks. Review policies for the actual operator. Follow ../../docs/site-launch.md. Do not reuse another site's resources automatically. Typecheck and build are required. The D1 ID is configured; remote migrations and R2 setup are still pending. Email delivery and the support inbox must be verified before launch.

For exact PowerShell steps and Workers Builds settings, see [DEPLOY.zh-CN.md](./DEPLOY.zh-CN.md).
