import { createCore } from '@shipwords/core/server';
import { createJobs } from '@shipwords/jobs/handlers';
import site, { legacyProducts } from '../site.config';
import models from '../site.models';

// Server singleton: route files only delegate; business logic lives in packages.
export const core = createCore({ ...site, products: [...site.products, ...legacyProducts] });
export const jobsApi = createJobs(core, models);
