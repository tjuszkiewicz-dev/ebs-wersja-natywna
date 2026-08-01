// Testy endpointu usuwania konta (recenzja I4).
// Czyste funkcje pokrywa `lib/users/accountPurge.test.ts` — tutaj sprawdzamy to,
// czego tamte testy z definicji nie dosięgają: bramki, audyt-przed-operacją
// i FAKTYCZNĄ kolejność wywołań wobec bazy.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock warstwy uwierzytelniania ──────────────────────────────────────────
const authState: { user: any } = { user: null };
vi.mock('@/lib/apiAuth', () => ({
  getAuthUserWithRole: async () => authState.user,
}));

// ── Mock klienta bazy ──────────────────────────────────────────────────────
// Rejestruje KAŻDĄ operację w `calls`, żeby dało się asertować sekwencję,
// a nie tylko wynik.
interface DbScenario {
  profile: any;
  counts: Record<string, number>;
  failAudit?: boolean;
  failDeleteUser?: { message: string; status?: number };
  getUserByIdResult?: { data: any; error: any };
}

const scenario: DbScenario = { profile: null, counts: {} };
let calls: string[] = [];

function makeClient() {
  const from = (table: string) => {
    const api: any = {
      select: (_cols: string, opts?: any) => {
        const q: any = {
          eq: (column: string, _val: string) => {
            if (opts?.head) {
              calls.push(`count:${table}.${column}`);
              return Promise.resolve({ count: scenario.counts[`${table}.${column}`] ?? 0, error: null });
            }
            calls.push(`select:${table}.${column}`);
            const res = { data: scenario.profile, error: null };
            return Object.assign(Promise.resolve(res), { maybeSingle: () => Promise.resolve(res) });
          },
        };
        return q;
      },
      update: (patch: any) => ({
        eq: (column: string, _val: string) => {
          calls.push(`update:${table}.${column}:${Object.keys(patch).join(',')}`);
          return Promise.resolve({ error: null });
        },
      }),
      delete: () => ({
        eq: (column: string, _val: string) => {
          calls.push(`delete:${table}.${column}`);
          return Promise.resolve({ error: null });
        },
      }),
      insert: (_row: any) => {
        calls.push(`insert:${table}`);
        return Promise.resolve({
          error: scenario.failAudit ? { message: 'audit down' } : null,
        });
      },
    };
    return api;
  };

  return {
    from,
    auth: {
      admin: {
        deleteUser: async (_id: string) => {
          calls.push('auth.deleteUser');
          return { data: null, error: scenario.failDeleteUser ?? null };
        },
        getUserById: async (_id: string) => {
          calls.push('auth.getUserById');
          return scenario.getUserByIdResult ?? { data: { user: null }, error: null };
        },
        updateUserById: async (_id: string, attrs: any) => {
          calls.push(`auth.updateUserById:${Object.keys(attrs).join(',')}`);
          return { data: null, error: null };
        },
      },
    },
  };
}

vi.mock('@/lib/supabase', () => ({
  supabaseServer: () => makeClient(),
}));

const { GET, DELETE } = await import('./route');

const OWNER = { id: 'owner-id', email: 'wlasciciel@example.invalid', role: 'superadmin', isOwner: true };
const TARGET_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const params = Promise.resolve({ id: TARGET_ID });
const req = (body?: any) => ({ json: async () => { if (!body) throw new Error('no body'); return body; } }) as any;

beforeEach(() => {
  calls = [];
  authState.user = { ...OWNER };
  scenario.profile = { id: TARGET_ID, full_name: 'Jan Kowalski', role: 'pracownik' };
  scenario.counts = {};
  scenario.failAudit = false;
  scenario.failDeleteUser = undefined;
  scenario.getUserByIdResult = undefined;
});

/** Indeks pierwszej operacji niszczącej (update/delete/auth.*), -1 gdy żadnej. */
const firstDestructive = () =>
  calls.findIndex((c) => /^(update|delete|auth\.)/.test(c));

// Wpisy `update:` niosą też listę zmienianych kolumn, więc porównujemy prefiksem.
// `idx` celowo rzuca przy braku wpisu — inaczej asercje kolejności przechodziłyby
// na -1, czyli „nie znaleziono" udawałoby „było wcześniej".
const has = (prefix: string) => calls.some((c) => c.startsWith(prefix));
const idx = (prefix: string) => {
  const i = calls.findIndex((c) => c.startsWith(prefix));
  if (i < 0) throw new Error(`brak wywołania "${prefix}" w: ${calls.join(' | ')}`);
  return i;
};

describe('bramki bezpieczeństwa', () => {
  it('superadmin NIEBĘDĄCY właścicielem → 403', async () => {
    authState.user = { id: 'x', email: 'a@b.c', role: 'superadmin', isOwner: false };
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(res.status).toBe(403);
    expect(firstDestructive()).toBe(-1);
  });

  it('brak sesji → 403', async () => {
    authState.user = null;
    expect((await GET({} as any, { params })).status).toBe(403);
    expect((await DELETE(req({ confirm: 'Jan Kowalski' }), { params })).status).toBe(403);
    expect(firstDestructive()).toBe(-1);
  });

  it('próba usunięcia własnego konta → 400', async () => {
    authState.user = { ...OWNER, id: TARGET_ID };
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/własnego konta/i);
    expect(firstDestructive()).toBe(-1);
  });

  it('próba usunięcia konta właściciela → 400', async () => {
    scenario.profile = { id: TARGET_ID, full_name: 'Szef', role: 'owner' };
    const res = await DELETE(req({ confirm: 'Szef' }), { params });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/właściciela/i);
    expect(firstDestructive()).toBe(-1);
  });

  it('nieistniejący profil → 404', async () => {
    scenario.profile = null;
    expect((await DELETE(req({ confirm: 'x' }), { params })).status).toBe(404);
    expect(firstDestructive()).toBe(-1);
  });

  it('niepoprawny identyfikator → 400', async () => {
    const res = await DELETE(req({ confirm: 'x' }), { params: Promise.resolve({ id: 'nie-uuid' }) });
    expect(res.status).toBe(400);
    expect(firstDestructive()).toBe(-1);
  });

  it('złe potwierdzenie → 400 i ZERO operacji niszczących', async () => {
    const res = await DELETE(req({ confirm: 'jan kowalski' }), { params });
    expect(res.status).toBe(400);
    expect(firstDestructive()).toBe(-1);
  });

  it('brak ciała żądania → 400', async () => {
    expect((await DELETE(req(), { params })).status).toBe(400);
    expect(firstDestructive()).toBe(-1);
  });
});

describe('audyt przed operacją', () => {
  it('wpis audytowy poprzedza PIERWSZĄ operację niszczącą', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    const audit = calls.indexOf('insert:audit_log');
    expect(audit).toBeGreaterThanOrEqual(0);
    expect(audit).toBeLessThan(firstDestructive());
  });

  it('nieudany zapis audytu → 500 i NIC nie zostało zniszczone', async () => {
    scenario.failAudit = true;
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/audytow/i);
    expect(firstDestructive()).toBe(-1);
  });
});

describe('wybór trybu', () => {
  it('czyste konto → purge', async () => {
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect((await res.json()).mode).toBe('purge');
  });

  it('konto z jedną transakcją w księdze → anonymize', async () => {
    scenario.counts['voucher_transactions.to_user_id'] = 1;
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect((await res.json()).mode).toBe('anonymize');
  });

  it('ciało żądania NIE MOŻE narzucić trybu', async () => {
    scenario.counts['vouchers.current_owner_id'] = 3;
    const res = await DELETE(req({ confirm: 'Jan Kowalski', mode: 'purge' }), { params });
    const body = await res.json();
    expect(body.mode).toBe('anonymize');
    expect(has('auth.deleteUser')).toBe(false);
  });

  it('GET zwraca tryb i frazę potwierdzenia, nie ruszając niczego', async () => {
    scenario.counts['buyback_agreements.user_id'] = 2;
    const res = await GET({} as any, { params });
    const body = await res.json();
    expect(body.mode).toBe('anonymize');
    expect(body.confirmPhrase).toBe('Jan Kowalski');
    expect(body.retainedPersonalData.some((r: any) => r.table === 'hr_employees')).toBe(true);
    expect(firstDestructive()).toBe(-1);
  });
});

describe('PURGE — faktyczna kolejność wywołań', () => {
  it('konto logowania kasowane PRZED profilem', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(idx('auth.deleteUser')).toBeLessThan(idx('delete:user_profiles.id'));
  });

  it('odpięcia idą przed kasowaniem, a kasowanie kont na końcu', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(idx('update:hr_employees.coordinator_id')).toBeLessThan(idx('delete:user_permissions.user_id'));
    expect(idx('delete:user_permissions.user_id')).toBeLessThan(idx('auth.deleteUser'));
  });

  it('kasuje powiadomienia jawnie (nie polega na kaskadzie)', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(has('delete:notifications.user_id')).toBe(true);
  });

  it('zrywa powiązanie z kartoteką kadrową', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(has('update:hr_employees.user_id')).toBe(true);
  });
});

describe('PURGE — tolerancja błędu „brak konta" (recenzja I3)', () => {
  it('błąd techniczny NIE jest tolerowany — profil zostaje', async () => {
    scenario.failDeleteUser = { message: 'relation "users" does not exist' };
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(res.status).toBe(500);
    expect(has('delete:user_profiles.id')).toBe(false);
  });

  it('„User not found" + potwierdzone zniknięcie → profil kasowany', async () => {
    scenario.failDeleteUser = { message: 'User not found' };
    scenario.getUserByIdResult = { data: { user: null }, error: null };
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(res.status).toBe(200);
    expect(idx('auth.getUserById')).toBeLessThan(idx('delete:user_profiles.id'));
  });

  it('„User not found", ale konto JEDNAK istnieje → 500, profil nietknięty', async () => {
    scenario.failDeleteUser = { message: 'User not found' };
    scenario.getUserByIdResult = { data: { user: { id: TARGET_ID } }, error: null };
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/nadal istnieje/i);
    expect(has('delete:user_profiles.id')).toBe(false);
  });

  it('nie da się potwierdzić stanu konta → 500, profil nietknięty', async () => {
    scenario.failDeleteUser = { message: 'User not found' };
    scenario.getUserByIdResult = { data: null, error: { message: 'service unavailable' } };
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(res.status).toBe(500);
    expect(has('delete:user_profiles.id')).toBe(false);
  });
});

describe('ANONIMIZACJA — księga i kartoteka', () => {
  beforeEach(() => { scenario.counts['voucher_transactions.to_user_id'] = 5; });

  it('nie kasuje profilu ani konta logowania', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(has('auth.deleteUser')).toBe(false);
    expect(has('delete:user_profiles.id')).toBe(false);
  });

  it('nie dotyka żadnej tabeli księgowej', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    const ledger = ['vouchers', 'voucher_transactions', 'commissions', 'buyback_agreements',
                    'buyback_batches', 'buyback_batch_items', 'distribution_batch_items'];
    for (const c of calls.filter((x) => /^(update|delete):/.test(x))) {
      expect(ledger.some((t) => c.includes(`:${t}.`))).toBe(false);
    }
  });

  it('ZACHOWUJE hr_employees.user_id (trop do danych kadrowych)', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(has('update:hr_employees.user_id')).toBe(false);
    expect(has('update:hr_employees.coordinator_id')).toBe(true);
  });

  it('wymazuje PII i odcina logowanie', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    const patch = calls.find((c) => c.startsWith('update:user_profiles.id:'))!;
    expect(patch).toContain('pesel');
    expect(patch).toContain('iban');
    expect(patch).toContain('status');
    expect(calls.some((c) => c.startsWith('auth.updateUserById:') && c.includes('ban_duration'))).toBe(true);
  });

  it('kasuje uprawnienia i powiadomienia mimo że konto zostaje', async () => {
    await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    expect(has('delete:user_permissions.user_id')).toBe(true);
    expect(has('delete:notifications.user_id')).toBe(true);
  });

  it('ostrzega o ograniczeniu unieważniania sesji', async () => {
    const res = await DELETE(req({ confirm: 'Jan Kowalski' }), { params });
    const body = await res.json();
    expect(body.warnings.some((w: string) => /token dostępu/i.test(w))).toBe(true);
  });
});
