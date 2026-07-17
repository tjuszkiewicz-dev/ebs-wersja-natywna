// Rejestr uprawnień EBS — jedyne źródło listy kluczy, etykiet i domyślnych
// zestawów per rola. Klient-safe (bez sekretów). Superadmin ZAWSZE ma wszystko
// (zablokowane w kodzie — patrz lib/permissions/server.ts).
// Port z BBS-Unified, przycięty do modułów EBS (bez CRM; agencja/księgowość dojdą w E2/E4).

export type PermKind = 'tab' | 'action';
export interface PermDef { key: string; label: string; kind: PermKind }
export interface PermGroup { name: string; perms: PermDef[] }

export const PERMISSION_GROUPS: PermGroup[] = [
  {
    name: 'Panel systemowy',
    perms: [
      { key: 'admin.pulpit', label: 'Pulpit (statystyki)', kind: 'tab' },
      { key: 'admin.logi', label: 'Logi systemowe (audyt zmian)', kind: 'tab' },
      { key: 'admin.uprawnienia', label: 'Uprawnienia użytkowników', kind: 'tab' },
    ],
  },
  {
    name: 'Benefity',
    perms: [
      { key: 'benefity.klienci', label: 'Baza klientów', kind: 'tab' },
      { key: 'benefity.platnosci', label: 'Płatności i faktury', kind: 'tab' },
      { key: 'benefity.archiwum', label: 'Archiwum', kind: 'tab' },
      { key: 'benefity.vouchery', label: 'Vouchery', kind: 'tab' },
      { key: 'benefity.buyback', label: 'Anulowanie subskrypcji', kind: 'tab' },
      { key: 'benefity.szablony', label: 'Szablony dokumentów', kind: 'tab' },
    ],
  },
  {
    name: 'Agencja Pracy',
    perms: [
      { key: 'agencja.pulpit', label: 'Pulpit Agencji (KPI + alerty)', kind: 'tab' },
      { key: 'agencja.poczekalnia', label: 'Poczekalnia (kandydaci do pracy)', kind: 'tab' },
      { key: 'agencja.kontrakty', label: 'Kontrakty i pracownicy', kind: 'tab' },
      { key: 'agencja.dokumenty', label: 'Dokumenty pracowników', kind: 'tab' },
      { key: 'agencja.raporty', label: 'Raporty agencji', kind: 'tab' },
      { key: 'agencja.rozliczenia', label: 'Rozliczenia pracowników (stawki, zaliczki, wypłaty)', kind: 'tab' },
      { key: 'agencja.noclegi', label: 'Baza Noclegowa', kind: 'tab' },
      { key: 'agencja.generator', label: 'Generator dokumentów (szablony, PDF)', kind: 'tab' },
      { key: 'agencja.archiwum', label: 'Archiwum pracowników', kind: 'tab' },
      { key: 'agencja.tlumacz', label: 'Tłumacz (komunikacja z pracownikami)', kind: 'tab' },
      { key: 'agencja.flota', label: 'Flota (pojazdy agencji)', kind: 'tab' },
      { key: 'agencja.dowoz', label: 'Plan dowozu (busy, przydział miejsc)', kind: 'tab' },
      { key: 'agencja.bhp', label: 'Magazyn BHP / sprzętu', kind: 'tab' },
      { key: 'agencja.legalizacja', label: 'Legalizacja pobytu (wnioski, terminy)', kind: 'tab' },
      { key: 'agencja.mapa', label: 'Mapa Pracowników (lokalizacja na żywo)', kind: 'tab' },
      { key: 'agencja.delete', label: 'Usuwanie pracowników / kontraktów / noclegów', kind: 'action' },
    ],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key));

export const AGENCJA_TABS = ['agencja.pulpit', 'agencja.poczekalnia', 'agencja.kontrakty', 'agencja.dokumenty', 'agencja.raporty', 'agencja.rozliczenia', 'agencja.noclegi', 'agencja.generator', 'agencja.archiwum', 'agencja.tlumacz', 'agencja.flota', 'agencja.dowoz', 'agencja.bhp', 'agencja.legalizacja'];

// Domyślne zestawy per rola DB. ADAPTACJA EBS vs BBS: agencja jest modułem
// wewnętrznym Strattona — pracodawcy-klienci EBS ani role sieciowe NIE dostają
// agencji domyślnie (w BBS dostawali). Wyjątki nadaje panel Uprawnienia.
export const DEFAULT_ROLE_PERMS: Record<string, string[]> = {
  pracodawca: [], pracownik: [], partner: [], menedzer: [], dyrektor: [], hr: [],
  koordynator: [...AGENCJA_TABS, 'agencja.mapa'],
  platnik: [], pracownik_tymczasowy: [],
};
