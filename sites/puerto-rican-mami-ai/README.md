# Puerto Rican Mami AI

- Target keyword: puerto rican mami ai; secondary: puerto rican mami dance ai, AI duo dance.
- Search intent: use personal photos and a motion reference to create a dance video.
- Domain: puertoricanmamiai.com.
- Hosting: Cloudflare Workers, D1 and R2. Local tests use a mock upstream; they do not verify real model output or a paid Stripe transaction.
- API integration tests cover email OTP without free generation credits, image uploads, fixed-reference checks, scene-specific Yir payloads, mock delivery, cancellation refunds and failure refunds. Repeated settlement does not return credits twice.
- Competitors: AI Dance, MakeViral and Jump on the Trend's Puerto Rican Mami pages.
- Difference: fixed dance reference, clear left/right photo mapping, optional custom scenes and transparent mock-result labeling. No generation prompt writing is required.

## Local development
Node 24, pnpm 10. Run pnpm install at the root, then pnpm setup:worktree. Keep local secrets outside the repository (SHIPWORDS_SECRETS), UPSTREAM_MOCK=1 and test payment credentials. In this site run pnpm db:generate, pnpm db:migrate:local and pnpm dev. Sign-in codes print to the terminal. The mock returns the reference unchanged, with no AI generation.

## Reference pipeline
The operator uploads the fixed 2�C20 second MP4 (up to 30 MB) to `assets/site/reference.mp4` and a separate sample to `assets/site/example.mp4` in R2; see [MEDIA.zh-CN.md](./MEDIA.zh-CN.md). Visitors cannot replace the dance video. The server validates its duration before charging. Video uses `reference_video`; dancer and background photos use `reference_image`. Shared credits, auth and workflow are unchanged.

## Scene choices

- **Keep original scene** (default): preserve the reference environment and lighting. Older drafts and clients retain this behavior.
- **Describe a new scene**: a required setting description, up to 600 characters, changes the environment only.
- **Use a background photo**: upload a JPG, PNG or WebP up to 10 MB through the existing image upload endpoint. Optional scene details guide atmosphere and lighting. The photo supplies scenery, not dancer identity.

The server selects separate environment instructions and keeps the same choreography, camera, framing, timing and audio instructions. It rejects invalid scenes and external background URLs before spending credits. Inactive background uploads and stale descriptions are ignored. Solo backgrounds become `@image_2`; duo backgrounds become `@image_3`. The resolved prompt and references are stored with the job, so the workflow does not lose custom scene choices. These are model instructions; exact scene, motion and audio matching are not guaranteed.

The frontend remains in English and saves scene choices with dancer photos in session storage. Each generation still costs 10 credits; the $9.99 / $24.99 / $49.99 packs provide 1 / 3 / 8 videos. A settled payment and enough available credits are required.

One photo replaces the dancer initially on the left; two replace both initial positions, following identities through crossings. The real Yir/Kling edit path needs an end-to-end paid test before launch. Exact timing, audio, identity quality and actual cost are unverified.

## Verification

Run `pnpm test` in this site. The flow test bundles and calls the actual Shipwords auth, credit, job and runner code. Test-only SQLite/R2/Email bindings live in `tests/support/`; Workflow steps run directly with a zero-delay mock adapter. No network listener, external email, provider call or real payment is involved. This validates API integration, not Cloudflare runtime behavior or browser interaction.

The operator MP4 is passed to the shared effect resolver as its versioned R2 key, so both local HTTP and production HTTPS URLs are constructed correctly. Passing a full local HTTP URL would incorrectly produce a double-prefixed file address; the flow test covers that regression.

## Launch
Verify the puertoricanmamiai.com custom domain, support@puertoricanmamiai.com inbox, D1, R2, email, upstream and payment keys/products/webhooks. Review policies for the actual operator. Follow ../../docs/site-launch.md. Do not reuse another site's resources automatically. Typecheck and build are required. Validate live email delivery, a paid checkout and real generation separately from the local test suite.

For exact PowerShell steps and Workers Builds settings, see [DEPLOY.zh-CN.md](./DEPLOY.zh-CN.md).
