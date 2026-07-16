# E2a: Agencja — Fundamenty + Schemat (port z BBS-Unified) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fundamenty modułu Agencji Pracy w EBS: schemat 22 tabel `hr_*` (introspekcja z żywej bazy BBS), nowe role, grupa uprawnień Agencja, appka `agencja` w launcherze (placeholder), silnik podatkowy i renderer PDF w neutralnych lokalizacjach, usunięcie backdoora `INTERNAL_API_KEY`.

**Architecture:** Kontynuacja wzorców E1: porty do NOWYCH katalogów, edycje punktowe tylko w wymienionych plikach EBS, migracje 048/049 aplikowane przez MCP do Supabase EBS (`ramedybmybcpqvelsmxd`) ze smoke-testem zapisu na każdej tabeli (lekcja 046). Spec: `docs/superpowers/specs/2026-07-17-e2-agencja-design.md`; mapa: `.superpowers/sdd/e2-recon.md`.

**Tech Stack:** Next.js 15, Supabase, vitest, puppeteer-core + @sparticuz/chromium (jedyne nowe deps E2a).

## Global Constraints

- Supabase EBS: `ramedybmybcpqvelsmxd`; żywa baza BBS do introspekcji (odczyt WYŁĄCZNIE `information_schema`/`pg_catalog`, zero dotykania danych): projekt **bbs-unified** — potwierdź ref przez `mcp__supabase__list_projects` (oczekiwany `pcszyyjwrkkkgbbcpzhn`).
- Po każdym tasku `npx tsc --noEmit` = 0 błędów; commit tylko plików z taska (`git add <lista>`, nigdy `-A`); repo ma niezwiązane brudne pliki — nie dotykać.
- Nowe deps TYLKO: `puppeteer-core`, `@sparticuz/chromium`. Zero nowych cronów.
- Role DB po E2a: `superadmin, pracodawca, pracownik, partner, menedzer, dyrektor, hr, koordynator, szef_koordynatorow, platnik, pracownik_tymczasowy`.
- **Adaptacja EBS (celowe odejście od BBS, decyzja „Stratton wewnętrznie"):** `pracodawca`/`hr`/`dyrektor` NIE dostają domyślnie uprawnień agencji (w BBS dostawali). Agencja domyślnie: `koordynator` (+`szef_koordynatorow` przez customized z importu E1) + superadmin.
- Komunikaty/komentarze po polsku. Commit message + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Praca na gałęzi `feat/e2a-agencja-fundamenty` (Task 1 tworzy z `main`).
- **Doprecyzowanie względem specu (świadome):** `existingAppTarget('agencja', …)` pozostaje `null` w E2a (spec sugerował cel `/dashboard/admin`, ale zakładki agencji w panelu admina powstają dopiero w E2b — do tego czasu `/app/agencja` pokazuje placeholder E1 „Moduł w budowie"). E2b dopina cel.

---

### Task 1: Gałąź + rozszerzenie ról w kodzie (enums, roleMap)

**Files:**
- Modify: `types/enums.ts` (enum `Role`)
- Modify: `lib/roleMap.ts` (DbRole, ROLE_TO_DB, DB_TO_ROLE, ROLE_LABEL, ROLE_DASHBOARD)

**Interfaces:**
- Produces: `Role.HR_PANEL`, `Role.COORDINATOR`, `Role.PAYROLL`, `Role.TEMP_WORKER`; mapowania DB `hr`, `koordynator`, `szef_koordynatorow`, `platnik`, `pracownik_tymczasowy`. Taski 4, 5 używają tych wartości.

- [ ] **Step 1: Gałąź**

```bash
cd "C:/Users/Użytkownik/Desktop/ebs-wersja-natywna"
git checkout main && git checkout -b feat/e2a-agencja-fundamenty
```

- [ ] **Step 2: `types/enums.ts` — rozszerz enum Role.** Zamień:

```ts
export enum Role {
  SUPERADMIN = 'SUPERADMIN',
  HR = 'HR',
  EMPLOYEE = 'EMPLOYEE',
  DIRECTOR = 'DIRECTOR',
  MANAGER = 'MANAGER',
  ADVISOR = 'ADVISOR'
}
```

na:

```ts
export enum Role {
  SUPERADMIN = 'SUPERADMIN',
  HR = 'HR',
  EMPLOYEE = 'EMPLOYEE',
  DIRECTOR = 'DIRECTOR',
  MANAGER = 'MANAGER',
  ADVISOR = 'ADVISOR',
  // E2a (agencja pracy, port z BBS-Unified):
  HR_PANEL = 'HR_PANEL',       // delegowany kadrowiec (DB: 'hr')
  COORDINATOR = 'COORDINATOR', // koordynator agencji (DB: 'koordynator')
  PAYROLL = 'PAYROLL',         // płatnik (DB: 'platnik')
  TEMP_WORKER = 'TEMP_WORKER'  // pracownik tymczasowy (DB: 'pracownik_tymczasowy')
}
```

- [ ] **Step 3: `lib/roleMap.ts` — dopisz mapowania.** DbRole:

```ts
export type DbRole =
  | 'superadmin'
  | 'pracodawca'
  | 'pracownik'
  | 'partner'
  | 'menedzer'
  | 'dyrektor'
  // E2a (agencja):
  | 'hr'
  | 'koordynator'
  | 'szef_koordynatorow'
  | 'platnik'
  | 'pracownik_tymczasowy';
```

ROLE_TO_DB — dopisz na końcu obiektu:

```ts
  [Role.HR_PANEL]:    'hr',
  [Role.COORDINATOR]: 'koordynator',
  [Role.PAYROLL]:     'platnik',
  [Role.TEMP_WORKER]: 'pracownik_tymczasowy',
```

DB_TO_ROLE — dopisz:

```ts
  hr:                   Role.HR_PANEL,
  koordynator:          Role.COORDINATOR,
  szef_koordynatorow:   Role.COORDINATOR, // rola własna — zachowuje się jak koordynator
  platnik:              Role.PAYROLL,
  pracownik_tymczasowy: Role.TEMP_WORKER,
```

ROLE_LABEL — dopisz:

```ts
  [Role.HR_PANEL]:    'Panel HR',
  [Role.COORDINATOR]: 'Koordynator',
  [Role.PAYROLL]:     'Płatnik',
  [Role.TEMP_WORKER]: 'Pracownik Tymczasowy',
```

ROLE_DASHBOARD — dopisz (portal pracownika `/dashboard/agencja` powstaje w E2e; do tego czasu launcher/appTargets decydują):

```ts
  [Role.HR_PANEL]:    '/dashboard/employer',
  [Role.COORDINATOR]: '/dashboard/admin',
  [Role.PAYROLL]:     '/dashboard/admin',
  [Role.TEMP_WORKER]: '/dashboard/agencja',
```

- [ ] **Step 4: Weryfikacja + commit**

Run: `npx tsc --noEmit` → 0 błędów; `npx vitest run lib` → wszystkie dotychczasowe przechodzą (nowe wpisy Record wymuszą kompletność — jeśli tsc krzyczy o brakującym kluczu w jakimś `Record<Role,...>` poza roleMap, dopisz brakujące wpisy per komunikat kompilatora i wypisz je w raporcie).

```bash
git add types/enums.ts lib/roleMap.ts
git commit -m "feat(e2a): role agencji w enum Role + roleMap (koordynator/platnik/temp_worker/hr)"
```

---

### Task 2: Migracja `048_agencja_schema.sql` — introspekcja żywej bazy BBS → 22 tabele w EBS

**Files:**
- Create: `supabase/migrations/048_agencja_schema.sql`

**Interfaces:**
- Consumes: MCP supabase (`list_projects`, `execute_sql` na projekcie BBS **tylko odczyt katalogów systemowych**, `apply_migration` + `execute_sql` na EBS `ramedybmybcpqvelsmxd`); `fn_audit_log()` (po 046 działa z kluczami złożonymi).
- Produces: 22 tabele `hr_*` w EBS o kolumnach IDENTYCZNYCH jak w BBS (E2b-e portują kod, który ich używa bez zmian): `hr_accommodations, hr_accommodation_photos, hr_advances, hr_bhp_issues, hr_bhp_items, hr_contracts, hr_coordinator_contracts, hr_coordinator_pay, hr_doc_templates, hr_documents, hr_employees, hr_legalization, hr_locations, hr_payouts, hr_schedule, hr_settlements, hr_translator_usage, hr_transport_assignments, hr_vehicle_costs, hr_vehicle_photos, hr_vehicles, hr_work_sessions`.

- [ ] **Step 1: Potwierdź projekt BBS** — `mcp__supabase__list_projects`; znajdź „bbs-unified" (oczekiwany ref `pcszyyjwrkkkgbbcpzhn`). NIE ruszaj innych projektów.

- [ ] **Step 2: Introspekcja (odczyt katalogów, zero danych).** Na projekcie BBS wykonaj i zapisz wyniki:

```sql
-- kolumny wszystkich 22 tabel
SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default,
       character_maximum_length, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema='public' AND table_name LIKE 'hr\_%'
ORDER BY table_name, ordinal_position;
-- klucze główne/unikalne/obce
SELECT tc.table_name, tc.constraint_type, tc.constraint_name,
       kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name AND tc.constraint_type='FOREIGN KEY'
WHERE tc.table_schema='public' AND tc.table_name LIKE 'hr\_%'
ORDER BY tc.table_name, tc.constraint_type;
-- CHECK-i
SELECT rel.relname AS table_name, con.conname, pg_get_constraintdef(con.oid) AS def
FROM pg_constraint con JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname='public' AND rel.relname LIKE 'hr\_%' AND con.contype='c';
-- indeksy
SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname='public' AND tablename LIKE 'hr\_%' ORDER BY tablename;
-- RLS + polityki
SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname LIKE 'hr\_%';
SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
WHERE schemaname='public' AND tablename LIKE 'hr\_%';
```

- [ ] **Step 3: Wygeneruj `supabase/migrations/048_agencja_schema.sql`** — DDL wiernie odtwarzający wynik introspekcji, z nagłówkiem:

```sql
-- E2a: schemat modułu Agencji Pracy — odtworzony introspekcją z żywej bazy BBS-Unified
-- (tabele hr_* nie miały plików migracji w BBS; źródło prawdy = information_schema).
-- Adaptacje EBS: FK do auth.users/user_profiles zachowane; RLS jak w BBS
-- (odczyt własnych wierszy pracownika tam, gdzie BBS je miał; zapisy service_role);
-- + triggery fn_audit_log na tabelach zapisywanych przez panel.
```

Reguły generowania: `CREATE TABLE IF NOT EXISTS` w kolejności respektującej FK; typy/nullability/defaulty/CHECK/UNIQUE/indeksy 1:1 z introspekcji; `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` na wszystkich; polityki przeniesione z BBS 1:1 (deny-all tam, gdzie BBS nie miał polityk); triggery audytu:

```sql
DROP TRIGGER IF EXISTS trg_audit_<tabela> ON public.<tabela>;
CREATE TRIGGER trg_audit_<tabela>
  AFTER INSERT OR UPDATE OR DELETE ON public.<tabela>
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
```

na tabelach: `hr_employees, hr_contracts, hr_documents, hr_doc_templates, hr_settlements, hr_advances, hr_payouts, hr_accommodations, hr_vehicles, hr_bhp_items, hr_bhp_issues, hr_legalization, hr_coordinator_contracts, hr_coordinator_pay` (operacyjne o wysokiej wadze; pominięte celowo: `hr_locations`, `hr_work_sessions`, `hr_translator_usage`, `hr_schedule`, foto — wysoki wolumen, niska waga audytowa).

- [ ] **Step 4: Zaaplikuj do EBS** — `mcp__supabase__apply_migration` (projekt `ramedybmybcpqvelsmxd`, name `048_agencja_schema`).

- [ ] **Step 5: Weryfikacja porównawcza + smoke zapisu.** (a) Uruchom na EBS to samo zapytanie o kolumny co w Step 2 i porównaj z BBS — różnice = 0 (raportuj diff jeśli są). (b) Dla KAŻDEJ z 22 tabel wykonaj rollback-safe write-smoke (lekcja 046):

```sql
DO $$ BEGIN
  INSERT INTO public.<tabela> (<minimalne kolumny NOT NULL bez default>) VALUES (<wartości testowe>);
  RAISE EXCEPTION 'rollback';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'rollback' THEN RAISE; END IF;
END $$;
```

Jeśli którakolwiek tabela wymaga FK do istniejącego wiersza (np. `hr_documents.employee_id`), użyj zagnieżdżonego INSERTu rodzica w tym samym DO-bloku. Wszystkie 22 muszą przejść bez błędu (poza celowym 'rollback').

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/048_agencja_schema.sql
git commit -m "feat(db): 048 schemat agencji - 22 tabele hr_* (introspekcja z zywej bazy BBS)"
```

---

### Task 3: Migracja `049_agencja_roles_buckets.sql` — constraint ról + seedy + buckety

**Files:**
- Create: `supabase/migrations/049_agencja_roles_buckets.sql`

**Interfaces:**
- Consumes: tabela `app_roles` (E1/045); `storage.buckets`.
- Produces: role DB akceptowane przez constraint; wiersze `app_roles` dla nowych ról; buckety `hr-documents`, `accommodation-photos`, `vehicle-photos` (private).

- [ ] **Step 1: Sprawdź obecny constraint** (EBS, `execute_sql`):

```sql
SELECT con.conname, pg_get_constraintdef(con.oid)
FROM pg_constraint con JOIN pg_class rel ON rel.oid=con.conrelid
JOIN pg_namespace ns ON ns.oid=rel.relnamespace
WHERE ns.nspname='public' AND rel.relname='user_profiles' AND con.contype='c';
```

Zanotuj nazwę constraintu roli (jeśli istnieje) — użyj jej w DROP poniżej; jeśli nie istnieje, DROP IF EXISTS i tak jest bezpieczny.

- [ ] **Step 2: Utwórz `supabase/migrations/049_agencja_roles_buckets.sql`**

```sql
-- E2a: role agencji + katalog rol + buckety storage
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('superadmin','pracodawca','pracownik','partner','menedzer','dyrektor',
                  'hr','koordynator','szef_koordynatorow','platnik','pracownik_tymczasowy'));

INSERT INTO public.app_roles (role, label, is_system) VALUES
  ('hr',                   'Panel HR',              true),
  ('koordynator',          'Koordynator',           true),
  ('platnik',              'Płatnik',               true),
  ('pracownik_tymczasowy', 'Pracownik Tymczasowy',  true)
ON CONFLICT (role) DO NOTHING;
-- szef_koordynatorow już istnieje (import E1, customized=true)

INSERT INTO storage.buckets (id, name, public) VALUES
  ('hr-documents',        'hr-documents',        false),
  ('accommodation-photos','accommodation-photos',false),
  ('vehicle-photos',      'vehicle-photos',      false)
ON CONFLICT (id) DO NOTHING;
-- dostęp do plików wyłącznie signed URL przez service_role (brak polityk storage.objects)
```

UWAGA: jeśli Step 1 wykazał constraint o INNEJ nazwie obejmujący `role`, dodaj przed ADD także `DROP CONSTRAINT IF EXISTS <ta_nazwa>`.

- [ ] **Step 3: Zaaplikuj + zweryfikuj**

`apply_migration` (name `049_agencja_roles_buckets`), potem:

```sql
SELECT role, label FROM app_roles ORDER BY role;                       -- 10 ról (6 E1 + 4 nowe; szef już był → razem 11 wierszy z szef_koordynatorow)
SELECT id, public FROM storage.buckets WHERE id LIKE 'hr-%' OR id LIKE '%photos'; -- 3 wiersze, public=false
DO $$ BEGIN
  UPDATE public.user_profiles SET role='koordynator' WHERE false;      -- constraint przyjmuje nową wartość (parse-check)
END $$;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/049_agencja_roles_buckets.sql
git commit -m "feat(db): 049 role agencji (constraint+app_roles) + buckety hr-documents/accommodation/vehicle"
```

---

### Task 4: Uprawnienia — grupa „Agencja Pracy" + sync (TDD)

**Files:**
- Modify: `lib/permissions/registry.ts`
- Modify: `lib/permissions/server.ts`
- Create: `app/api/permissions/sync/route.ts`
- Test: `lib/permissions/registry.test.ts` (rozszerzenie)

**Interfaces:**
- Consumes: `supabaseServer()`, `getAuthUserWithRole()`, tabele `app_roles`/`role_permissions` (E1).
- Produces: `AGENCJA_TABS: string[]` (14 kluczy tab bez `.mapa` i `.delete` — jak BBS), klucze `agencja.*` w `ALL_PERMISSIONS`, `syncAgencyPermsForCustomizedRoles(): Promise<{role,added}[]>`, `POST /api/permissions/sync`. E2b gate'uje route'y przez `can(auth,'agencja.…')`.

- [ ] **Step 1: Rozszerz test `lib/permissions/registry.test.ts`** — zamień test grup i dodaj asercje:

```ts
  it('grupy: Panel systemowy, Benefity i Agencja Pracy', () => {
    expect(PERMISSION_GROUPS.map(g => g.name)).toEqual(['Panel systemowy', 'Benefity', 'Agencja Pracy']);
  });
  it('AGENCJA_TABS = 14 kluczy tab (bez mapa i delete)', () => {
    expect(AGENCJA_TABS).toHaveLength(14);
    expect(AGENCJA_TABS.every(k => k.startsWith('agencja.'))).toBe(true);
    expect(AGENCJA_TABS).not.toContain('agencja.mapa');
    expect(AGENCJA_TABS).not.toContain('agencja.delete');
  });
  it('koordynator domyślnie: AGENCJA_TABS + mapa; pracodawca/dyrektor/hr NIC z agencji (EBS-adaptacja)', () => {
    expect(DEFAULT_ROLE_PERMS['koordynator']).toEqual([...AGENCJA_TABS, 'agencja.mapa']);
    for (const r of ['pracodawca', 'dyrektor', 'hr']) {
      expect((DEFAULT_ROLE_PERMS[r] ?? []).some(k => k.startsWith('agencja.'))).toBe(false);
    }
  });
```

(dopisz import `AGENCJA_TABS` do istniejącego importu z `./registry`). Run: `npx vitest run lib/permissions/registry.test.ts` → FAIL (brak grupy/eksportu).

- [ ] **Step 2: `lib/permissions/registry.ts`** — po grupie „Benefity" dodaj grupę (16 kluczy, 1:1 z BBS):

```ts
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
```

Po `ALL_PERMISSIONS` dodaj (1:1 z BBS):

```ts
export const AGENCJA_TABS = ['agencja.pulpit', 'agencja.poczekalnia', 'agencja.kontrakty', 'agencja.dokumenty', 'agencja.raporty', 'agencja.rozliczenia', 'agencja.noclegi', 'agencja.generator', 'agencja.archiwum', 'agencja.tlumacz', 'agencja.flota', 'agencja.dowoz', 'agencja.bhp', 'agencja.legalizacja'];
```

`DEFAULT_ROLE_PERMS` — zamień na (EBS-adaptacja: agencja TYLKO dla koordynatora; komentarz obowiązkowy):

```ts
// Domyślne zestawy per rola DB. ADAPTACJA EBS vs BBS: agencja jest modułem
// wewnętrznym Strattona — pracodawcy-klienci EBS ani role sieciowe NIE dostają
// agencji domyślnie (w BBS dostawali). Wyjątki nadaje panel Uprawnienia.
export const DEFAULT_ROLE_PERMS: Record<string, string[]> = {
  pracodawca: [], pracownik: [], partner: [], menedzer: [], dyrektor: [], hr: [],
  koordynator: [...AGENCJA_TABS, 'agencja.mapa'],
  platnik: [], pracownik_tymczasowy: [],
};
```

Run: `npx vitest run lib/permissions/registry.test.ts` → wszystkie PASS.

- [ ] **Step 3: `lib/permissions/server.ts`** — nad `getEffectivePermissions` dodaj (adaptacja BBS: `supabaseServer` zamiast `admin`, bez roli `owner`):

```ts
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMS, AGENCJA_TABS } from './registry';

// Auto-sync uprawnień agencji dla ról „customized" (np. szef_koordynatorow):
// gdy do registry dojdzie NOWA zakładka agencji, role już „agencyjne" dostają
// brakujące automatycznie. Idempotentne (dodaje tylko braki).
export async function syncAgencyPermsForCustomizedRoles(): Promise<{ role: string; added: string[] }[]> {
  const sb = supabaseServer() as any;
  const { data: roles } = await sb.from('app_roles').select('role').eq('customized', true);
  const result: { role: string; added: string[] }[] = [];
  for (const r of roles ?? []) {
    const role = (r as any).role;
    if (role === 'superadmin') continue;
    const { data: existing } = await sb.from('role_permissions').select('permission').eq('role', role);
    const have = new Set((existing ?? []).map((x: any) => x.permission));
    if (!AGENCJA_TABS.some(p => have.has(p))) continue; // rola nie jest „agencyjna" — pomijamy
    const missing = AGENCJA_TABS.filter(p => !have.has(p));
    if (!missing.length) continue;
    const { error } = await sb.from('role_permissions').insert(missing.map(p => ({ role, permission: p })));
    if (!error) result.push({ role, added: missing });
  }
  return result;
}
```

(zastąp dotychczasową linię importu `ALL_PERMISSIONS, DEFAULT_ROLE_PERMS` powyższą z `AGENCJA_TABS`).

- [ ] **Step 4: `app/api/permissions/roles/route.ts`** — w GET, po bramce superadmina a przed `Promise.all`, dodaj linię (wzorzec BBS):

```ts
  // auto-uzupełnienie nowych zakładek agencji dla ról customized (idempotentne)
  await syncAgencyPermsForCustomizedRoles().catch(() => {});
```

(+ import `syncAgencyPermsForCustomizedRoles` z `@/lib/permissions/server`).

- [ ] **Step 5: Utwórz `app/api/permissions/sync/route.ts`**

```ts
// POST /api/permissions/sync — ręczne uzupełnienie nowych zakładek agencji dla ról
// customized (zwykle dzieje się automatycznie przy otwarciu listy ról).
import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { syncAgencyPermsForCustomizedRoles } from '@/lib/permissions/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin' }, { status: 403 });
  const synced = await syncAgencyPermsForCustomizedRoles();
  return NextResponse.json({ ok: true, synced });
}
```

- [ ] **Step 6: Weryfikacja + commit**

Run: `npx vitest run lib/permissions` → PASS; `npx tsc --noEmit` → 0.

```bash
git add lib/permissions/registry.ts lib/permissions/server.ts lib/permissions/registry.test.ts app/api/permissions/sync/route.ts app/api/permissions/roles/route.ts
git commit -m "feat(e2a): grupa uprawnien Agencja Pracy (16 kluczy) + syncAgencyPerms + POST /api/permissions/sync"
```

---

### Task 5: Appka `agencja` w launcherze (TDD)

**Files:**
- Modify: `lib/apps/registry.ts` (wpis APPS)
- Modify: `components/shell/AppTile.tsx` (DESCRIPTIONS)
- Test: `lib/apps/access.test.ts` (aktualizacja oczekiwań)

**Interfaces:**
- Consumes: `Role.COORDINATOR/PAYROLL/TEMP_WORKER` (Task 1).
- Produces: appka `agencja` widoczna w launcherze dla ról agencyjnych i superadmina; `/app/agencja` renderuje istniejący placeholder E1 („Moduł w budowie") — `existingAppTarget` zwraca null dla `agencja` (bez zmian w appTargets; cel dopnie E2b/E2e).

- [ ] **Step 1: Zaktualizuj `lib/apps/access.test.ts`** — zamień DWA testy i dodaj jeden:

```ts
  it('SUPERADMIN → wszystkie zarejestrowane', () => {
    expect(appsForUser(Role.SUPERADMIN, []).sort()).toEqual(['agencja', 'benefity']);
  });

  it('SUPERADMIN: revoke ignorowany', () => {
    expect(appsForUser(Role.SUPERADMIN, [{ app_id: 'benefity', effect: 'revoke' }]).sort())
      .toEqual(['agencja', 'benefity']);
  });

  it('COORDINATOR → agencja; TEMP_WORKER → agencja; EMPLOYEE bez agencji', () => {
    expect(appsForUser(Role.COORDINATOR, [])).toEqual(['agencja']);
    expect(appsForUser(Role.TEMP_WORKER, [])).toEqual(['agencja']);
    expect(appsForUser(Role.EMPLOYEE, [])).toEqual(['benefity']);
  });
```

Run: `npx vitest run lib/apps/access.test.ts` → FAIL (agencja niezarejestrowana).

- [ ] **Step 2: `lib/apps/registry.ts`** — do tablicy APPS dodaj po wpisie benefity:

```ts
  {
    id: 'agencja',
    name: 'Agencja Pracy',
    icon: 'hard-hat',
    route: '/app/agencja',
    defaultRoles: [Role.COORDINATOR, Role.PAYROLL, Role.TEMP_WORKER, Role.SUPERADMIN],
  },
```

- [ ] **Step 3: `components/shell/AppTile.tsx`** — w DESCRIPTIONS dodaj:

```ts
  agencja: 'Pracownicy tymczasowi, kontrakty, noclegi i rozliczenia.',
```

- [ ] **Step 4: Weryfikacja + commit**

Run: `npx vitest run lib/apps lib/auth` → PASS (postLoginRedirect: superadmin ma teraz 2 appki → `/launcher` — pokrywa to istniejący test „wiele appek"); `npx tsc --noEmit` → 0.

```bash
git add lib/apps/registry.ts lib/apps/access.test.ts components/shell/AppTile.tsx
git commit -m "feat(e2a): appka agencja w launcherze (placeholder /app/agencja do E2b)"
```

---

### Task 6: Port silnika podatkowego → `lib/agencja/tax-engine` (TDD)

**Files:**
- Create: `lib/agencja/tax-engine/` — kopie 7 plików z `C:\Users\Użytkownik\Desktop\BBS-Unified\lib\crm\tax-engine\`: `calculator.ts, constants.ts, grossUp.ts, index.ts, pit.ts, types.ts, zus.ts`
- Test: `lib/agencja/tax-engine/calculator.test.ts`

**Interfaces:**
- Consumes: nic z EBS (moduł czysty — zero importów zewnętrznych, zweryfikowane w rekonesansie).
- Produces: eksporty `index.ts` 1:1 z BBS (m.in. `DEFAULT_CONFIG`, funkcje kalkulacji brutto↔netto/ZUS/PIT — dokładne nazwy przepisz z `index.ts` przy porcie). E2b (rozliczenia) importuje z `@/lib/agencja/tax-engine`.

- [ ] **Step 1: Skopiuj katalog**

```bash
mkdir -p lib/agencja/tax-engine
cp "C:/Users/Użytkownik/Desktop/BBS-Unified/lib/crm/tax-engine/"*.ts lib/agencja/tax-engine/
```

Następnie: `grep -n "from '@/lib/crm" lib/agencja/tax-engine/*.ts` → oczekiwane: brak trafień (moduł czysty). Jeśli są — popraw na ścieżki wewnętrzne `./...` i odnotuj w raporcie.

- [ ] **Step 2: Napisz test `lib/agencja/tax-engine/calculator.test.ts`** — asercje INWARIANTOWE (nie przepisuj kwot z głowy — silnik ma konfigurację roczną):

```ts
import { describe, it, expect } from 'vitest';
import { calculateSalary, DEFAULT_CONFIG } from './index';

// Uwaga: jeśli index.ts eksportuje inną nazwę funkcji kalkulującej (sprawdź eksporty!),
// użyj faktycznej nazwy i popraw ten test PRZED pierwszym uruchomieniem.
describe('tax-engine (inwarianty płacowe PL)', () => {
  it('UOP 5000 brutto: netto < brutto, składniki > 0, suma spójna', () => {
    const r: any = calculateSalary({ gross: 5000, contractType: 'UOP' } as any, DEFAULT_CONFIG as any);
    expect(r.net).toBeGreaterThan(3000);
    expect(r.net).toBeLessThan(5000);
    expect(r.zusEmployee ?? r.zus?.employee ?? 0).toBeGreaterThan(0);
  });
  it('wyższe brutto → wyższe netto (monotoniczność)', () => {
    const a: any = calculateSalary({ gross: 4000, contractType: 'UOP' } as any, DEFAULT_CONFIG as any);
    const b: any = calculateSalary({ gross: 8000, contractType: 'UOP' } as any, DEFAULT_CONFIG as any);
    expect(b.net).toBeGreaterThan(a.net);
  });
});
```

**WAŻNE:** przed uruchomieniem odczytaj `lib/agencja/tax-engine/index.ts` i `types.ts` — dopasuj nazwy funkcji/pól w teście do FAKTYCZNYCH eksportów (sygnatury w BBS mogą różnić się od powyższego szkicu; szkic pokazuje intencję inwariantów, nie wiążący interfejs). Docelowy test NIE może zawierać `as any` — użyj prawdziwych typów z `types.ts`.

- [ ] **Step 3: Uruchom testy**

Run: `npx vitest run lib/agencja/tax-engine` → PASS (2 testy); `npx tsc --noEmit` → 0.

- [ ] **Step 4: Commit**

```bash
git add lib/agencja/tax-engine
git commit -m "feat(e2a): port tax-engine (kalkulacje placowe PL) z BBS do lib/agencja/tax-engine"
```

---

### Task 7: Port renderera PDF → `lib/pdf/renderer.ts` + deps

**Files:**
- Create: `lib/pdf/renderer.ts` (kopia `C:\Users\Użytkownik\Desktop\BBS-Unified\lib\crm\offer\pdfRenderer.ts`)
- Modify: `package.json` (deps przez npm)

**Interfaces:**
- Consumes: `puppeteer-core`, `@sparticuz/chromium` (nowe deps); env `PDF_SERVER_URL` opcjonalnie (fallback lokalny — EBS ma już ten env).
- Produces: `renderOfferPdfBatch(...)` — dokładna sygnatura z pliku BBS (przepisz przy porcie). E2c (doc-generate) i E2b (settlements/pdf) importują z `@/lib/pdf/renderer`.

- [ ] **Step 1: Instalacja deps**

```bash
npm install puppeteer-core @sparticuz/chromium
```

- [ ] **Step 2: Skopiuj plik**

```bash
mkdir -p lib/pdf
cp "C:/Users/Użytkownik/Desktop/BBS-Unified/lib/crm/offer/pdfRenderer.ts" lib/pdf/renderer.ts
```

Przejrzyj importy pliku: dozwolone tylko `puppeteer-core`/`@sparticuz/chromium`/node built-ins. Jeśli plik czyta lokalny PDF-serwer z hardcode `localhost:3015` — zostaw (EBS używa tego samego portu). Jeśli odwołuje się do fontów/logo z `public/` — NIE kopiuj assetów w tym tasku (E2c), tylko odnotuj w raporcie, które ścieżki będą potrzebne.

- [ ] **Step 3: Weryfikacja + commit**

Run: `npx tsc --noEmit` → 0 błędów. (Runtime smoke renderowania odbędzie się w E2c przy pierwszym użyciu — na Vercelu ścieżka @sparticuz działa, co potwierdza produkcja BBS.)

```bash
git add lib/pdf/renderer.ts package.json package-lock.json
git commit -m "feat(e2a): port renderera PDF (puppeteer-core + @sparticuz/chromium) do lib/pdf/renderer"
```

---

### Task 8: Usunięcie backdoora `INTERNAL_API_KEY` z `lib/apiAuth.ts`

**Files:**
- Modify: `lib/apiAuth.ts`

**Interfaces:**
- Produces: `getAuthUserWithRole()`/`getAuthUser()` bez ścieżki dev-vite; sygnatury bez zmian (konsumenci nietknięci).

- [ ] **Step 1: Sprawdź użycia**

```bash
grep -rn "INTERNAL_API_KEY\|isInternalRequest\|x-internal-key\|dev-vite" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".next"
```

Oczekiwane: trafienia WYŁĄCZNIE w `lib/apiAuth.ts`. Jeśli są inne — STOP, raportuj BLOCKED z listą.

- [ ] **Step 2: Usuń z `lib/apiAuth.ts`:** całą funkcję `isInternalRequest`, import `headers` z `next/headers` (jeśli po usunięciu nieużywany), blok w `getAuthUserWithRole`:

```ts
  // Żądania z Vite dev proxy — traktuj jako superadmin (dev mode)
  if (await isInternalRequest()) {
    return { id: 'dev-vite', email: 'dev@ebs.local', role: 'superadmin' };
  }
```

oraz blok w `getAuthUser`:

```ts
  if (await isInternalRequest()) {
    return { id: 'dev-vite', ... } as unknown as User;
  }
```

(dokładne brzmienie w pliku — usuń cały if wraz z komentarzem).

- [ ] **Step 3: Sprawdź env na Vercelu** (odczyt listy nazw, bez wartości):

```bash
npx vercel env ls 2>&1 | grep -i internal || echo "OK - brak INTERNAL_API_KEY na Vercelu"
```

Zanotuj wynik w raporcie. Jeśli zmienna ISTNIEJE — odnotuj w raporcie jako czerwoną flagę (kontroler zdecyduje o usunięciu; sam jej nie usuwaj).

- [ ] **Step 4: Weryfikacja + commit**

Run: `npx tsc --noEmit` → 0; `npx vitest run` → wszystkie PASS.

```bash
git add lib/apiAuth.ts
git commit -m "fix(security): usuniecie backdoora INTERNAL_API_KEY/dev-vite z apiAuth (zalecenie final review E1)"
```

---

### Task 9: Weryfikacja końcowa + CLAUDE.md + merge + deploy + smoke

**Files:**
- Modify: `CLAUDE.md` (sekcja Shell/Launcher — dopisek E2a)

**Interfaces:** brak nowych — task domykający.

- [ ] **Step 1: Pełna weryfikacja**

Run: `npx vitest run` → wszystkie PASS (62 z E1 + nowe: registry +3, access +1/zmienione 2, tax-engine +2); `npx tsc --noEmit` → 0.

- [ ] **Step 2: CLAUDE.md** — w sekcji `### Shell / Launcher…`, po akapicie „Uwaga: role sieciowe…", dopisz akapit:

```markdown
**E2a (2026-07-17):** appka `agencja` w rejestrze (placeholder `/app/agencja` do czasu E2b);
role agencji w DB/enum: `hr`, `koordynator`, `szef_koordynatorow`, `platnik`,
`pracownik_tymczasowy` (migracja 049); schemat 22 tabel `hr_*` z introspekcji żywej bazy BBS
(migracja 048); grupa uprawnień „Agencja Pracy" (16 kluczy; ADAPTACJA EBS: domyślnie tylko
koordynator — pracodawcy/role sieciowe nie dostają agencji); silnik płacowy
`lib/agencja/tax-engine`, renderer PDF `lib/pdf/renderer.ts` (puppeteer-core+@sparticuz).
Backdoor `INTERNAL_API_KEY` usunięty z `lib/apiAuth.ts`. Buckety: `hr-documents`,
`accommodation-photos`, `vehicle-photos` (private).
```

```bash
git add CLAUDE.md
git commit -m "docs(claude): E2a - fundamenty agencji"
```

- [ ] **Step 3: Merge + push** (fast-forward)

```bash
git fetch . feat/e2a-agencja-fundamenty:main
git push origin main
```

- [ ] **Step 4: Deploy**

```bash
npx vercel --prod --yes
```

Expected: `readyState: READY`, alias `https://ebs.elitonbenefits.pl`.

- [ ] **Step 5: Smoke produkcyjny**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://ebs.elitonbenefits.pl/login              # 200
curl -s -o /dev/null -w "%{http_code}\n" https://ebs.elitonbenefits.pl/app/agencja        # 307 (bez sesji)
curl -s -o /dev/null -w "%{http_code}\n" https://ebs.elitonbenefits.pl/api/permissions/sync # 405 lub 403 (GET niedozwolony/brak sesji — odnotuj faktyczny)
```

Ręcznie (kontroler/użytkownik): superadmin loguje się → **ląduje na `/launcher` z DWOMA kafelkami** (Benefity + Agencja Pracy — pierwszy raz launcher aktywny!); klik Agencja → placeholder „Moduł w budowie"; pracownik loguje się → bez zmian (`/dashboard/employee`).

- [ ] **Step 6: Raport końcowy** — co wdrożone, czerwone flagi (np. INTERNAL_API_KEY na Vercelu), następny krok: plan E2b (core HR).
