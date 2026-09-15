// Czysta logika sklepu benefitów — bez Reacta, żeby dało się ją testować i użyć po stronie serwera.
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §4–§5.
import { BenefitCategory } from '@/types/enums';
import type { ServiceItem } from '@/types';
import { INITIAL_SERVICES } from '@/services/mockData';

export interface CategoryDef {
  id: BenefitCategory;
  label: string;
  description: string;
  icon: string; // nazwa ikony lucide, mapowana w UI
}

export const BENEFIT_CATEGORIES: readonly CategoryDef[] = [
  { id: BenefitCategory.ZDROWIE,       label: 'Zdrowie',       description: 'Opieka medyczna, badania i dobrostan psychiczny.', icon: 'HeartPulse' },
  { id: BenefitCategory.UBEZPIECZENIA, label: 'Ubezpieczenia', description: 'Ochrona Ciebie, rodziny i domu.',                   icon: 'ShieldCheck' },
  { id: BenefitCategory.FINANSE,       label: 'Finanse',       description: 'Emerytura, oszczędzanie i mądre wydawanie.',        icon: 'Landmark' },
  { id: BenefitCategory.ROZWOJ,        label: 'Rozwój',        description: 'Kursy i umiejętności na dziś i na jutro.',           icon: 'GraduationCap' },
  { id: BenefitCategory.RODZINA,       label: 'Rodzina',       description: 'Dla dzieci, domu i wspólnego czasu.',                icon: 'Users' },
  { id: BenefitCategory.CODZIENNOSC,   label: 'Codzienność',   description: 'Rozrywka, telekomunikacja i codzienne sprawy.',     icon: 'Sparkles' },
];

export type CategoryFilter = BenefitCategory | 'ALL';
export type StoreAction = 'buy' | 'inquire' | 'open' | 'insufficient';
export type EmployeeAppTab = 'WELLBEING' | 'LEGAL' | 'SECURE_MESSENGER' | 'DIGITAL_VAULT';

/** Aplikacje Eliton: id w katalogu → zakładka pełnoekranowa w DashboardEmployee. */
export const APP_TAB_BY_SERVICE: Readonly<Record<string, EmployeeAppTab>> = {
  'SRV-MENTAL-01': 'WELLBEING',
  'SRV-LEGAL-01':  'LEGAL',
  'SRV-SECURE-01': 'SECURE_MESSENGER',
  'SRV-VAULT-01':  'DIGITAL_VAULT',
};

/** Małe litery, bez diakrytyków (NFD + usunięcie znaków łączących), ł→l, przycięte spacje. */
export function normalizeSearch(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase()
    .trim();
}

function matchesQuery(item: ServiceItem, q: string): boolean {
  if (!q) return true;
  const hay = normalizeSearch(`${item.name} ${item.description} ${item.partner ?? ''}`);
  return hay.includes(q);
}

export function filterCatalog(
  items: ServiceItem[],
  opts: { category?: CategoryFilter; query?: string },
): ServiceItem[] {
  const q = normalizeSearch(opts.query ?? '');
  const cat = opts.category ?? 'ALL';
  return items.filter(i => i.isActive && (cat === 'ALL' || i.category === cat) && matchesQuery(i, q));
}

/** Płatne rosnąco po cenie, potem „Zapytaj o ofertę"; remisy alfabetycznie (pl). */
export function sortForSection(items: ServiceItem[]): ServiceItem[] {
  const collator = new Intl.Collator('pl');
  return [...items].sort((a, b) => {
    const aFree = a.price === 0 ? 1 : 0;
    const bFree = b.price === 0 ? 1 : 0;
    if (aFree !== bFree) return aFree - bFree;
    if (a.price !== b.price) return a.price - b.price;
    return collator.compare(a.name, b.name);
  });
}

export function groupByCategory(items: ServiceItem[]): { category: CategoryDef; items: ServiceItem[] }[] {
  const active = items.filter(i => i.isActive);
  return BENEFIT_CATEGORIES
    .map(category => ({ category, items: sortForSection(active.filter(i => i.category === category.id)) }))
    .filter(g => g.items.length > 0);
}

export function countByCategory(items: ServiceItem[]): { total: number; byCategory: Record<BenefitCategory, number> } {
  const byCategory = Object.fromEntries(BENEFIT_CATEGORIES.map(c => [c.id, 0])) as Record<BenefitCategory, number>;
  let total = 0;
  for (const i of items) {
    if (!i.isActive) continue;
    total++;
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
  }
  return { total, byCategory };
}

/** Jedna decyzja dla kafelka i panelu szczegółów (spec §5.3). Rola użytkownika jest sprawdzana wyżej. */
export function resolveAction(item: ServiceItem, ownedIds: ReadonlySet<string>, balance: number): StoreAction {
  if (item.fulfillment === 'auto' && ownedIds.has(item.id)) return 'open';
  if (item.price === 0) return 'inquire';
  if (item.price > balance) return 'insufficient';
  return 'buy';
}

/** Pozycja z katalogu w kodzie — używane też po stronie serwera do walidacji ceny. */
export function findCatalogItem(id: string): ServiceItem | undefined {
  return INITIAL_SERVICES.find(s => s.id === id);
}

/** Liczba unikalnych partnerów zewnętrznych (bez Eliton) — statystyka na Pulpicie. */
export function partnerCount(items: ServiceItem[]): number {
  const set = new Set(items.map(i => i.partner).filter((p): p is string => !!p && p !== 'Eliton'));
  return set.size;
}
