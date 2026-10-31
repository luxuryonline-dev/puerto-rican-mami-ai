import type { Product } from '@shipwords/core/site';
import site from '../../site.config';
import models from '../../site.models';

/** Catalog-derived comparisons, not former prices or separate checkout discounts. */
export function packValue(product: Product) {
  const starter = site.products[0];
  const cost = models[0].credits;
  if (!starter || product.kind !== 'credits' || starter.kind !== 'credits' || cost <= 0 ||
    product.credits % cost !== 0 || starter.credits <= 0 || product.price.currency !== starter.price.currency) return null;
  const videos = product.credits / cost;
  if (videos <= 0) return null;
  const comparisonCents = Math.round(starter.price.amount * product.credits / starter.credits);
  const savingsCents = Math.max(0, comparisonCents - product.price.amount);
  return {
    videos,
    perVideoCents: product.price.amount / videos,
    comparisonCents,
    savingsCents,
    savingsPercent: comparisonCents > 0 ? (100 * savingsCents / comparisonCents).toFixed(1) : '0.0',
  };
}
