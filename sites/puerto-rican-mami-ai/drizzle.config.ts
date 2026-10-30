import { defineConfig } from 'drizzle-kit';

// Migrations are generated from the packages schema plus this site's schema, with timestamp prefixes so parallel work never collides.
// When a packages table changes, run pnpm db:generate once in each site.
export default defineConfig({
  dialect: 'sqlite',
  schema: [
    './node_modules/@shipwords/core/src/db/schema.ts',
    './node_modules/@shipwords/jobs/src/schema.ts',
    './src/site/schema.ts',
  ],
  out: './migrations',
  migrations: { prefix: 'timestamp' },
});
