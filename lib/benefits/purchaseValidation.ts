import type { ServiceItem } from '@/types';
import { findCatalogItem } from './catalog';

export type PurchaseValidation =
  | { ok: true; kind: 'catalog'; item: ServiceItem }
  | { ok: true; kind: 'internal' }
  | { ok: false; error: 'invalid_id' | 'unknown_service' | 'not_purchasable' | 'price_mismatch' };

/**
 * Serwer nie ufa cenie z przeglądarki (spec §6.2): pozycja katalogowa musi istnieć, być aktywna,
 * mieć cenę > 0 i dokładnie taką kwotę. INTERNAL-* to mikrowydatki wewnątrz aplikacji Eliton
 * (AI Coach, biblioteka premium) — kwota pochodzi z aplikacji, jak dotąd.
 */
export function validatePurchase(serviceId: string, amount: number): PurchaseValidation {
  if (serviceId.startsWith('INTERNAL-')) return { ok: true, kind: 'internal' };
  if (!serviceId.startsWith('SRV-')) return { ok: false, error: 'invalid_id' };
  const item = findCatalogItem(serviceId);
  if (!item) return { ok: false, error: 'unknown_service' };
  if (!item.isActive || item.price <= 0) return { ok: false, error: 'not_purchasable' };
  if (amount !== item.price) return { ok: false, error: 'price_mismatch' };
  return { ok: true, kind: 'catalog', item };
}
