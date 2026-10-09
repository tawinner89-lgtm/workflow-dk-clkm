import business from '../../../shared/business.json';

export const salesCatalog = business.sales_catalog;
export const catalogBrands = salesCatalog.brands_in_stock;
export const catalogBtuOptions = salesCatalog.btu_options;
export const catalogAcTypes = salesCatalog.accepted_ac_types as string[];
export type CatalogOffer = {
  brand: string;
  btu: string;
  modele: string;
  prix_normal?: number;
  prix_promo: number;
  installation_incluse: boolean;
};
export const catalogOffers = salesCatalog.promotions_completes as CatalogOffer[];
export const servicePrices = business.repair_and_maintenance.tarifs_services;

export function getCatalogOffers(brand: string, btu: string): CatalogOffer[] {
  return catalogOffers.filter((offer) => offer.brand.toLowerCase() === brand.toLowerCase() && offer.btu.toUpperCase() === btu.toUpperCase());
}
