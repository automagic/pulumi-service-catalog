import catalog from '../data/catalog.json';
import type { Catalog } from '../models';

export const prerender = true;
const items: Catalog = catalog;

export const load = (() => {
  return {
    items
  };
})
