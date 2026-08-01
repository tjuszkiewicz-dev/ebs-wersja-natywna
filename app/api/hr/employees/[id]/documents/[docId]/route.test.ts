// Testy strażnika zakresu koordynatora przy usuwaniu dokumentu z teczki pracownika (fala E5).
// Chroni przed przypadkowym skasowaniem skanu (Storage) razem z rekordem, gdy koordynator
// nie ma dostępu do pracownika LUB gdy docId podano dla cudzego pracownika.
// Wzorzec (mock apiAuth + mock warstwy bazy, asercje na WYWOŁANIACH nie na implementacji)
// skopiowany z `app/api/users/[id]/purge/route.test.ts`.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock warstwy uwierzytelniania ──────────────────────────────────────────
const authState: { user: any } = { user: null };
vi.mock('@/lib/apiAuth', () => ({
  getAuthUserWithRole: async () => authState.user,
}));

// ── Mock warstwy uprawnień (can/canAny) — testujemy strażnik trasy, nie samą
// logikę uprawnień (to pokrywają testy `lib/permissions/server`) ─────────────
const permState = { canAny: true, canDeleteDocs: true };
vi.mock('@/lib/permissions/server', () => ({
  can: async (_auth: any, permission: string) => {
    if (permission === 'agencja.dokumenty-usun') return permState.canDeleteDocs;
    return true;
  },
  canAny: async (_auth: any, _permissions: string[]) => permState.canAny,
}));

// ── Mock zakresu kontraktów koordynatora ────────────────────────────────────
const scopeState: { granted: string[] } = { granted: [] };
vi.mock('@/lib/hr/coordinatorScope', () => ({
  coordinatorGrantedContractIds: async (_userId: string) => scopeState.granted,
}));

// ── Mock klienta bazy (admin()) — rejestruje wywołania Storage/delete, żeby
// dało się asertować, że NIC nie zostało skasowane przy odrzuceniu ─────────
interface DbScenario {
  employee: any;
  document: any;
}
const scenario: DbScenario = { employee: null, document: null };
let removeCalls: string[][] = [];
let deleteCalls: string[] = [];

function makeClient() {
  return {
    from: (table: string) => {
      if (table === 'hr_employees') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              single: async () => ({ data: scenario.employee, error: null }),
            }),
          }),
        };
      }
      if (table === 'hr_documents') {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              single: async () => ({ data: scenario.document, error: null }),
            }),
          }),
          delete: () => ({
            eq: async (_col: string, id: string) => {
              deleteCalls.push(id);
              return { error: null };
            },
          }),
        };
      }
      throw new Error(`nieoczekiwana tabela w teście: ${table}`);
    },
    storage: {
      from: (_bucket: string) => ({
        remove: async (paths: string[]) => {
          removeCalls.push(paths);
          return { data: null, error: null };
        },
      }),
    },
  };
}

vi.mock('@/lib/supabaseAdmin', () => ({
  admin: () => makeClient(),
}));

const { DELETE } = await import('./route');

const EMP_ID = 'employee-uuid-1';
const OTHER_EMP_ID = 'employee-uuid-2';
const DOC_ID = 'doc-uuid-1';
const COORDINATOR_ID = 'coordinator-uuid-1';

const params = (id: string, docId: string) => Promise.resolve({ id, docId });

beforeEach(() => {
  authState.user = null;
  permState.canAny = true;
  permState.canDeleteDocs = true;
  scopeState.granted = [];
  scenario.employee = null;
  scenario.document = null;
  removeCalls = [];
  deleteCalls = [];
});

describe('DELETE /api/hr/employees/[id]/documents/[docId] — strażnik zakresu koordynatora', () => {
  it('koordynator POZA zakresem (pracownik nie jego, brak kontraktu) → 403, zero operacji niszczących', async () => {
    authState.user = { id: COORDINATOR_ID, role: 'koordynator' };
    scenario.employee = { coordinator_id: 'ktos-inny', submitted_by: 'ktos-inny', candidate: false, contract_id: null };
    // dokument istnieje i formalnie należy do EMP_ID — sedno testu to zakres, nie przynależność
    scenario.document = { path: 'passport-scan.pdf', filename: 'paszport.pdf', employee_id: EMP_ID };

    const res = await DELETE({} as any, { params: params(EMP_ID, DOC_ID) });

    expect(res.status).toBe(403);
    expect(removeCalls).toHaveLength(0);
    expect(deleteCalls).toHaveLength(0);
  });

  it('koordynator W zakresie, ale docId należy do INNEGO pracownika → 404, zero storage.remove (kolejność: przynależność PRZED kasowaniem pliku)', async () => {
    authState.user = { id: COORDINATOR_ID, role: 'koordynator' };
    scenario.employee = { coordinator_id: COORDINATOR_ID, submitted_by: null, candidate: false, contract_id: null };
    scenario.document = { path: 'cudzy-skan.pdf', filename: 'x.pdf', employee_id: OTHER_EMP_ID };

    const res = await DELETE({} as any, { params: params(EMP_ID, DOC_ID) });

    expect(res.status).toBe(404);
    expect(removeCalls).toHaveLength(0);
    expect(deleteCalls).toHaveLength(0);
  });

  it('koordynator w zakresie, dokument jego pracownika, z uprawnieniem agencja.dokumenty-usun → sukces, plik skasowany', async () => {
    authState.user = { id: COORDINATOR_ID, role: 'koordynator' };
    scenario.employee = { coordinator_id: COORDINATOR_ID, submitted_by: null, candidate: false, contract_id: null };
    scenario.document = { path: 'wlasny-skan.pdf', filename: 'y.pdf', employee_id: EMP_ID };
    permState.canDeleteDocs = true;

    const res = await DELETE({} as any, { params: params(EMP_ID, DOC_ID) });

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(removeCalls).toEqual([['wlasny-skan.pdf']]);
    expect(deleteCalls).toEqual([DOC_ID]);
  });

  it('koordynator BEZ uprawnienia agencja.dokumenty-usun → 403 (zachowanie sprzed tej fali), zero operacji niszczących', async () => {
    authState.user = { id: COORDINATOR_ID, role: 'koordynator' };
    permState.canDeleteDocs = false;
    // nawet gdyby pracownik był w zakresie, brak uprawnienia ma odciąć wcześniej
    scenario.employee = { coordinator_id: COORDINATOR_ID, submitted_by: null, candidate: false, contract_id: null };
    scenario.document = { path: 'skan.pdf', filename: 'z.pdf', employee_id: EMP_ID };

    const res = await DELETE({} as any, { params: params(EMP_ID, DOC_ID) });

    expect(res.status).toBe(403);
    expect(removeCalls).toHaveLength(0);
    expect(deleteCalls).toHaveLength(0);
  });

  it('rola uprzywilejowana (superadmin) → działa bez ograniczeń zakresu koordynatora', async () => {
    authState.user = { id: 'admin-uuid-1', role: 'superadmin' };
    // scenario.employee celowo NIE ustawiony (null) — dla superadmina strażnik zakresu
    // w ogóle nie powinien odpytywać hr_employees, więc brak danych nie może zablokować operacji
    scenario.document = { path: 'skan-superadmin.pdf', filename: 'w.pdf', employee_id: EMP_ID };

    const res = await DELETE({} as any, { params: params(EMP_ID, DOC_ID) });

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(removeCalls).toEqual([['skan-superadmin.pdf']]);
    expect(deleteCalls).toEqual([DOC_ID]);
  });
});
