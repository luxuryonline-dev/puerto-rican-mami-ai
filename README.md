# Puerto Rican Mami AI

Independent repository for puertoricanmamiai.com, based on the MIT-licensed Shipwords framework: https://github.com/shipwords-dev/shipwords

The application is in sites/puerto-rican-mami-ai. packages/core and packages/jobs provide auth, credits, billing and generation lifecycle. The Tiny Desk site is excluded.

Use Node.js 24 and pnpm 10. Run pnpm install, then prepare local secrets with node sites/puerto-rican-mami-ai/scripts/setup-local.mjs and apply the site's local database migrations. Run pnpm dev or pnpm build from the repository root.

For a new Cloudflare Worker connected to this repository: branch main, root directory /, Node 24, build command pnpm build, deploy command pnpm run deploy. Configure resources, email and runtime secrets first; see sites/puerto-rican-mami-ai/DEPLOY.zh-CN.md.

The obsolete multi-site lockfile is excluded. The first pnpm install generates this repository's lockfile; .npmrc permits that bootstrap installation in CI. Commit the generated lockfile and enable frozen installs afterwards.

Domain and independent D1 ID are configured. The original application passed local typecheck, build, site checks and mock API integration tests. This repository's clean dependency install/build and production deployment remain unverified. Real model output/cost and live payments are not yet validated. Local mock mode returns the reference unchanged. Checkout stays disabled without a live payment key.
