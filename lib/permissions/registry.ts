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
];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap(g => g.perms.map(p => p.key));

// Domyślne zestawy per rola DB (E1: panel admina używa tylko superadmin — role puste;
// wypełnią się przy E2, gdy dojdą role koordynatorów itd.)
export const DEFAULT_ROLE_PERMS: Record<string, string[]> = {
  pracodawca: [], pracownik: [], partner: [], menedzer: [], dyrektor: [],
};
