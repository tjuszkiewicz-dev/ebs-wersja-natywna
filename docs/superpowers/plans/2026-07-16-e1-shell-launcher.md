# E1: Shell/Launcher + Uprawnienia (port z BBS-Unified do EBS) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EBS dostaje architekturę super-appa z BBS-Unified: launcher z kafelkami, dostęp do aplikacji per rola + wyjątki per użytkownik, fundament szczegółowych uprawnień (tab/action) i panel administracyjny „Uprawnienia".

**Architecture:** Port 1:1 modułu shell z `C:\Users\Użytkownik\Desktop\BBS-Unified` (dalej: **BBS**) do EBS, w nowych katalogach (`lib/apps`, `lib/permissions`, `components/shell`, `app/(shell)`), z trzema punktowymi edycjami istniejących plików EBS: `app/api/auth/role/route.ts` (redirect wg appek), `components/Sidebar.tsx` + `app/dashboard/_components/AdminDashboardClient.tsx` (pozycja „Uprawnienia"). Baza: migracje `044`/`045` w Supabase EBS. Spec: `docs/superpowers/specs/2026-07-16-e1-shell-launcher-design.md`.

**Tech Stack:** Next.js 15 App Router, Supabase (`@supabase/ssr` + service-role), Tailwind (EBS ma ramps `primary-*`=emerald, `secondary-*`=indigo — klasy BBS działają), lucide-react, vitest (alias `@` skonfigurowany w `vitest.config.ts`).

## Global Constraints

- Supabase EBS: projekt `ramedybmybcpqvelsmxd`; migracje aplikujemy przez MCP `mcp__supabase__apply_migration` I zapisujemy plik w `supabase/migrations/`.
- `next.config.ts` ma `ignoreBuildErrors: true` — **po każdym tasku uruchamiaj `npx tsc --noEmit`** (musi być 0 błędów).
- Żadnych nowych zależności npm; żadnych nowych cronów (Vercel Hobby, limit 2).
- Nie nadpisujemy istniejących plików EBS poza trzema wymienionymi wyżej. Wszystko inne to NOWE pliki.
- Role DB w EBS: `superadmin`, `pracodawca`, `pracownik`, `partner`, `menedzer`, `dyrektor` (patrz `lib/roleMap.ts`). NIE rozszerzamy w E1.
- Komunikaty UI po polsku. Komentarze w kodzie po polsku (konwencja repo).
- Commit po każdym tasku (`git add <konkretne pliki>`, nigdy `git add -A`).
- Praca na gałęzi `feat/e1-shell-launcher` (utworzonej w Task 1 z aktualnego HEAD).

**Świadome odstępstwa od specu** (uzasadnione, zaakceptować w review):
1. `api/org/users` + `components/adminNew/org` — **wykluczone**: kod zależy od `lib/crm/visibility` (hierarchia sieci sprzedaży) = moduł CRM, który jest wykluczony. Lista userów do zarządzania appkami jest w `GET /api/admin/entitlements`.
2. `api/permissions/sync` + `syncAgencyPermsForCustomizedRoles` — **odłożone do E2** (dotyczą wyłącznie zakładek agencji).
3. Dane `admin_view_config` z BBS — **nie kopiujemy** (katalog widoków BBS ≠ EBS; tabela powstaje pusta). Kopiujemy `app_roles` + `role_permissions` (bez kluczy `crm.*`).
4. `PERMISSION_MENU` (dynamiczne menu) — **odłożone do E2** (w E1 brak konsumenta; panel admina EBS jest tylko dla superadmina).

---

### Task 1: Gałąź + typ Entitlement + rejestr aplikacji + `appsForUser` (TDD)

**Files:**
- Create: `types/entitlement.ts`
- Create: `lib/apps/registry.ts`
- Create: `lib/apps/access.ts`
- Test: `lib/apps/access.test.ts`

**Interfaces:**
- Consumes: `Role` z `@/types/enums` (istnieje: SUPERADMIN, HR, EMPLOYEE, DIRECTOR, MANAGER, ADVISOR).
- Produces: `AppId`, `AppDef`, `APPS`, `APP_IDS`, `isAppId(x): x is AppId` (registry); `Entitlement` (types); `appsForUser(role, entitlements): AppId[]`, `canAccessApp(role, entitlements, appId): boolean` (access). Task 4, 5, 7 używają dokładnie tych nazw.

- [ ] **Step 1: Utwórz gałąź**

```bash
cd "C:/Users/Użytkownik/Desktop/ebs-wersja-natywna"
git checkout -b feat/e1-shell-launcher
```

- [ ] **Step 2: Utwórz `types/entitlement.ts`**

```ts
import type { AppId } from '@/lib/apps/registry';

export type Entitlement = { app_id: AppId; effect: 'grant' | 'revoke' };
```

- [ ] **Step 3: Utwórz `lib/apps/registry.ts`** (adaptacja z BBS `lib/apps/registry.ts`; w E1 tylko `benefity`, typ przygotowany na kolejne etapy)

```ts
import { Role } from '@/types/enums';

// AppId przygotowany na kolejne etapy migracji (E2: agencja+dokumenty, E3: komunikacja, E4: ksiegowosc).
// W E1 zarejestrowana jest wyłącznie appka 'benefity'. CRM celowo nie istnieje (osobny CRM Stratton Prime).
export type AppId = 'benefity' | 'agencja' | 'dokumenty' | 'komunikacja' | 'ksiegowosc';

export interface AppDef {
  id: AppId;
  name: string;
  icon: string;
  route: string;
  defaultRoles: Role[];
}

export const APPS: readonly AppDef[] = [
  {
    id: 'benefity',
    name: 'Benefity',
    icon: 'gift',
    route: '/app/benefity',
    defaultRoles: [Role.EMPLOYEE, Role.HR, Role.SUPERADMIN],
  },
] as const;

export const APP_IDS = APPS.map(a => a.id) as AppId[];

export const isAppId = (x: string): x is AppId =>
  (APP_IDS as string[]).includes(x);
```

> Uwaga: `isAppId` zwraca `true` tylko dla **zarejestrowanych** appek (w E1: `benefity`) — wpisy w DB dla nieistniejących appek są ignorowane. To zachowanie identyczne z BBS.

- [ ] **Step 4: Napisz failing test `lib/apps/access.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { Role } from '@/types/enums';
import { appsForUser, canAccessApp } from './access';

describe('appsForUser (EBS E1: tylko benefity w rejestrze)', () => {
  it('EMPLOYEE → benefity', () => {
    expect(appsForUser(Role.EMPLOYEE, [])).toEqual(['benefity']);
  });

  it('HR → benefity', () => {
    expect(appsForUser(Role.HR, [])).toEqual(['benefity']);
  });

  it('SUPERADMIN → wszystkie zarejestrowane', () => {
    expect(appsForUser(Role.SUPERADMIN, [])).toEqual(['benefity']);
  });

  it('SUPERADMIN: revoke ignorowany', () => {
    expect(appsForUser(Role.SUPERADMIN, [{ app_id: 'benefity', effect: 'revoke' }]))
      .toEqual(['benefity']);
  });

  it('ADVISOR bez defaultów → pusto', () => {
    expect(appsForUser(Role.ADVISOR, [])).toEqual([]);
  });

  it('grant dodaje appkę spoza defaultów roli', () => {
    expect(appsForUser(Role.ADVISOR, [{ app_id: 'benefity', effect: 'grant' }]))
      .toEqual(['benefity']);
  });

  it('revoke zabiera domyślną', () => {
    expect(appsForUser(Role.EMPLOYEE, [{ app_id: 'benefity', effect: 'revoke' }]))
      .toEqual([]);
  });

  it('canAccessApp spójny z appsForUser', () => {
    expect(canAccessApp(Role.EMPLOYEE, [], 'benefity')).toBe(true);
    expect(canAccessApp(Role.EMPLOYEE, [{ app_id: 'benefity', effect: 'revoke' }], 'benefity')).toBe(false);
  });
});
```

- [ ] **Step 5: Uruchom test — ma FAILować**

Run: `npx vitest run lib/apps/access.test.ts`
Expected: FAIL — `Cannot find module './access'`

- [ ] **Step 6: Utwórz `lib/apps/access.ts`** (kopia 1:1 z BBS `lib/apps/access.ts`)

```ts
import { APPS, type AppId } from '@/lib/apps/registry';
import { Role } from '@/types/enums';
import type { Entitlement } from '@/types/entitlement';

export function appsForUser(role: Role, entitlements: Entitlement[]): AppId[] {
  if (role === Role.SUPERADMIN) return APPS.map(a => a.id);
  const set = new Set<AppId>(
    APPS.filter(a => a.defaultRoles.includes(role)).map(a => a.id),
  );
  for (const e of entitlements) {
    if (e.effect === 'revoke') set.delete(e.app_id);
    else if (e.effect === 'grant') set.add(e.app_id);
  }
  return [...set];
}

export function canAccessApp(
  role: Role,
  entitlements: Entitlement[],
  appId: AppId,
): boolean {
  return appsForUser(role, entitlements).includes(appId);
}
```

- [ ] **Step 7: Testy przechodzą + tsc**

Run: `npx vitest run lib/apps/access.test.ts` → Expected: 8 passed
Run: `npx tsc --noEmit` → Expected: 0 błędów

- [ ] **Step 8: Commit**

```bash
git add types/entitlement.ts lib/apps/registry.ts lib/apps/access.ts lib/apps/access.test.ts
git commit -m "feat(shell): rejestr aplikacji + appsForUser (E1, port z BBS-Unified)"
```

---

### Task 2: `postLoginRedirect` + `appTargets` (TDD)

**Files:**
- Create: `lib/auth/postLoginRedirect.ts`
- Create: `lib/apps/appTargets.ts`
- Test: `lib/auth/postLoginRedirect.test.ts`

**Interfaces:**
- Consumes: `APPS`, `AppId` (Task 1); `Role` z `@/types/enums`.
- Produces: `postLoginRedirect(apps: AppId[]): string`; `existingAppTarget(appId: AppId, role: Role): string | null`; `resolvePostLogin(role: Role, apps: AppId[]): string` — Task 4 (auth/role) używa `resolvePostLogin`, Task 5 ([appId]) używa `existingAppTarget`.

- [ ] **Step 1: Failing test `lib/auth/postLoginRedirect.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { Role } from '@/types/enums';
import { postLoginRedirect, resolvePostLogin } from './postLoginRedirect';
import { existingAppTarget } from '@/lib/apps/appTargets';

describe('postLoginRedirect', () => {
  it('1 appka → jej route', () =>
    expect(postLoginRedirect(['benefity'])).toBe('/app/benefity'));
  it('>1 → launcher', () =>
    expect(postLoginRedirect(['benefity', 'agencja'])).toBe('/launcher'));
  it('0 → launcher', () => expect(postLoginRedirect([])).toBe('/launcher'));
});

describe('existingAppTarget (benefity → dashboardy EBS)', () => {
  it('EMPLOYEE → /dashboard/employee', () =>
    expect(existingAppTarget('benefity', Role.EMPLOYEE)).toBe('/dashboard/employee'));
  it('HR → /dashboard/employer', () =>
    expect(existingAppTarget('benefity', Role.HR)).toBe('/dashboard/employer'));
  it('SUPERADMIN → /dashboard/admin', () =>
    expect(existingAppTarget('benefity', Role.SUPERADMIN)).toBe('/dashboard/admin'));
  it('rola sieciowa → null (brak dashboardu benefitów)', () =>
    expect(existingAppTarget('benefity', Role.ADVISOR)).toBe(null));
});

describe('resolvePostLogin (final URL po zalogowaniu)', () => {
  it('EMPLOYEE z samymi benefitami → od razu dashboard (bez hopu przez /app)', () =>
    expect(resolvePostLogin(Role.EMPLOYEE, ['benefity'])).toBe('/dashboard/employee'));
  it('SUPERADMIN z 1 appką → od razu /dashboard/admin', () =>
    expect(resolvePostLogin(Role.SUPERADMIN, ['benefity'])).toBe('/dashboard/admin'));
  it('wiele appek → /launcher', () =>
    expect(resolvePostLogin(Role.SUPERADMIN, ['benefity', 'agencja'])).toBe('/launcher'));
  it('0 appek → /launcher (komunikat o braku dostępu)', () =>
    expect(resolvePostLogin(Role.ADVISOR, [])).toBe('/launcher'));
});
```

- [ ] **Step 2: Uruchom — FAIL** (`Cannot find module './postLoginRedirect'`)

Run: `npx vitest run lib/auth/postLoginRedirect.test.ts`

- [ ] **Step 3: Utwórz `lib/apps/appTargets.ts`** (adaptacja z BBS — tylko benefity; role sieciowe EBS nie mają targetu w E1)

```ts
import { Role } from '@/types/enums';
import type { AppId } from '@/lib/apps/registry';

/**
 * Aplikacje obsługiwane przez ISTNIEJĄCE dashboardy EBS — dokąd kierować wg roli.
 * null = brak istniejącego targetu (placeholder w /app/[appId]).
 */
export function existingAppTarget(appId: AppId, role: Role): string | null {
  switch (appId) {
    case 'benefity':
      if (role === Role.EMPLOYEE) return '/dashboard/employee';
      if (role === Role.HR) return '/dashboard/employer';
      if (role === Role.SUPERADMIN) return '/dashboard/admin';
      return null;
    default:
      return null; // przyszłe appki (E2+) dostaną własne trasy
  }
}
```

- [ ] **Step 4: Utwórz `lib/auth/postLoginRedirect.ts`** (BBS wersja + `resolvePostLogin` łączący z appTargets)

```ts
import { APPS, type AppId } from '@/lib/apps/registry';
import { Role } from '@/types/enums';
import { existingAppTarget } from '@/lib/apps/appTargets';

export function postLoginRedirect(apps: AppId[]): string {
  if (apps.length === 1) {
    const app = APPS.find(a => a.id === apps[0]);
    return app ? app.route : '/launcher';
  }
  return '/launcher';
}

/**
 * Finalny URL po zalogowaniu: jedna appka → od razu jej konkretny cel per rola
 * (bez pośredniego hopu przez /app/[appId]); wiele/zero → /launcher.
 */
export function resolvePostLogin(role: Role, apps: AppId[]): string {
  if (apps.length !== 1) return '/launcher';
  return existingAppTarget(apps[0], role) ?? postLoginRedirect(apps);
}
```

- [ ] **Step 5: Testy przechodzą + tsc**

Run: `npx vitest run lib/auth/postLoginRedirect.test.ts` → Expected: 11 passed
Run: `npx tsc --noEmit` → Expected: 0 błędów

- [ ] **Step 6: Commit**

```bash
git add lib/auth/postLoginRedirect.ts lib/auth/postLoginRedirect.test.ts lib/apps/appTargets.ts
git commit -m "feat(shell): postLoginRedirect + appTargets (1 appka → dashboard, >1 → launcher)"
```

---

### Task 3: Migracje DB 044 + 045 (entitlements + macierz uprawnień) i aplikacja do Supabase

**Files:**
- Create: `supabase/migrations/044_shell_entitlements.sql`
- Create: `supabase/migrations/045_permissions_matrix.sql`

**Interfaces:**
- Produces: tabele `user_app_entitlements`, `app_roles`, `role_permissions`, `user_permissions`, `admin_view_config` — używane przez Taski 4, 7, 8, 9. Kolumny dokładnie jak w SQL niżej.
- Consumes: funkcja `fn_audit_log()` (istnieje od `001_initial_schema.sql:858` — generyczna, per `TG_TABLE_NAME`).

- [ ] **Step 1: Utwórz `supabase/migrations/044_shell_entitlements.sql`**

```sql
-- E1 (port z BBS-Unified): wyjątki dostępu do aplikacji shell/launcher per użytkownik.
-- Wzór: BBS 037_user_app_entitlements + 039_shell_reconcile.
CREATE TABLE IF NOT EXISTS public.user_app_entitlements (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  app_id     text NOT NULL,
  effect     text NOT NULL CHECK (effect IN ('grant','revoke')),
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);
ALTER TABLE public.user_app_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own entitlements readable" ON public.user_app_entitlements;
CREATE POLICY "own entitlements readable" ON public.user_app_entitlements
  FOR SELECT USING (auth.uid() = user_id);
-- zapis wyłącznie przez service_role (panel superadmina) — brak polityk INSERT/UPDATE/DELETE

-- audyt zmian (EBS SP6: generyczny fn_audit_log)
DROP TRIGGER IF EXISTS trg_audit_user_app_entitlements ON public.user_app_entitlements;
CREATE TRIGGER trg_audit_user_app_entitlements
  AFTER INSERT OR UPDATE OR DELETE ON public.user_app_entitlements
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
```

- [ ] **Step 2: Utwórz `supabase/migrations/045_permissions_matrix.sql`**

```sql
-- E1 (port z BBS-Unified): macierz szczegółowych uprawnień (tab/action) + katalog ról
-- + konfiguracja widoczności widoków admina per rola. W BBS tabele istniały tylko
-- w żywej bazie (przez MCP) — tu definiujemy je jawnie.
CREATE TABLE IF NOT EXISTS public.app_roles (
  role       text PRIMARY KEY,
  label      text,
  is_system  boolean NOT NULL DEFAULT false,
  customized boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role       text NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL,
  effect     text NOT NULL CHECK (effect IN ('grant','revoke')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission)
);

CREATE TABLE IF NOT EXISTS public.admin_view_config (
  role       text NOT NULL,
  view_id    text NOT NULL,
  label      text,
  hidden     boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, view_id)
);

-- RLS: deny-all (brak polityk) — dostęp wyłącznie przez service_role w API
ALTER TABLE public.app_roles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_view_config ENABLE ROW LEVEL SECURITY;

-- seed ról systemowych EBS (etykiety jak lib/roleMap.ROLE_LABEL)
INSERT INTO public.app_roles (role, label, is_system) VALUES
  ('superadmin', 'Administrator', true),
  ('pracodawca', 'Pracodawca',    true),
  ('pracownik',  'Pracownik',     true),
  ('partner',    'Doradca',       true),
  ('menedzer',   'Manager',       true),
  ('dyrektor',   'Dyrektor',      true)
ON CONFLICT (role) DO NOTHING;

-- audyt zmian
DROP TRIGGER IF EXISTS trg_audit_app_roles ON public.app_roles;
CREATE TRIGGER trg_audit_app_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.app_roles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
DROP TRIGGER IF EXISTS trg_audit_role_permissions ON public.role_permissions;
CREATE TRIGGER trg_audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
DROP TRIGGER IF EXISTS trg_audit_user_permissions ON public.user_permissions;
CREATE TRIGGER trg_audit_user_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
DROP TRIGGER IF EXISTS trg_audit_admin_view_config ON public.admin_view_config;
CREATE TRIGGER trg_audit_admin_view_config
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_view_config
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
```

- [ ] **Step 3: Zaaplikuj obie migracje do Supabase EBS**

Użyj MCP: `mcp__supabase__apply_migration` (project `ramedybmybcpqvelsmxd`), osobno dla `044_shell_entitlements` i `045_permissions_matrix`, z treścią plików j.w.

- [ ] **Step 4: Weryfikacja w żywej bazie**

Użyj MCP `mcp__supabase__execute_sql`:
```sql
SELECT table_name FROM information_schema.tables WHERE table_schema='public'
AND table_name IN ('user_app_entitlements','app_roles','role_permissions','user_permissions','admin_view_config');
SELECT role, label, is_system FROM public.app_roles ORDER BY role;
```
Expected: 5 tabel; 6 wierszy `app_roles` (seed).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/044_shell_entitlements.sql supabase/migrations/045_permissions_matrix.sql
git commit -m "feat(db): 044 user_app_entitlements + 045 macierz uprawnien (app_roles/role_permissions/user_permissions/admin_view_config)"
```

---

### Task 4: Warstwa serwerowa appek: `getEntitlements`, `setEntitlement` (TDD), `getViewerApps`

**Files:**
- Create: `lib/apps/getEntitlements.ts`
- Create: `lib/apps/setEntitlement.ts`
- Create: `lib/apps/getViewerApps.ts`
- Test: `lib/apps/setEntitlement.test.ts`

**Interfaces:**
- Consumes: Task 1 (`registry`, `access`), Task 3 (tabela `user_app_entitlements`), EBS `lib/roleMap` (`DB_TO_ROLE`, typ `DbRole` — UWAGA: w EBS `DbRole` jest eksportowany z `lib/roleMap.ts`, a `Database` z `types/database`).
- Produces: `getEntitlements(supabase, userId): Promise<Entitlement[]>`; `resolveEntitlementWrite(role, current, appId, desiredVisible): {op:'delete'}|{op:'upsert';effect:'grant'|'revoke'}`; `getViewerApps(): Promise<{userId: string; role: Role; apps: AppId[]}>` (server-only, redirect('/login') gdy brak sesji). Taski 5, 6, 7 używają tych sygnatur.

- [ ] **Step 1: Failing test `lib/apps/setEntitlement.test.ts`** (adaptacja testu BBS do ról/appek EBS)

```ts
import { describe, it, expect } from 'vitest';
import { resolveEntitlementWrite } from './setEntitlement';
import { Role } from '@/types/enums';

describe('resolveEntitlementWrite', () => {
  it('odbierz domyślną → upsert revoke', () => {
    expect(resolveEntitlementWrite(Role.EMPLOYEE, [], 'benefity', false))
      .toEqual({ op: 'upsert', effect: 'revoke' });
  });
  it('dodaj obcą → upsert grant', () => {
    expect(resolveEntitlementWrite(Role.ADVISOR, [], 'benefity', true))
      .toEqual({ op: 'upsert', effect: 'grant' });
  });
  it('przywróć domyślną → delete (wpis zbędny)', () => {
    expect(resolveEntitlementWrite(Role.EMPLOYEE, [{ app_id: 'benefity', effect: 'revoke' }], 'benefity', true))
      .toEqual({ op: 'delete' });
  });
  it('ukryj obcą → delete', () => {
    expect(resolveEntitlementWrite(Role.ADVISOR, [{ app_id: 'benefity', effect: 'grant' }], 'benefity', false))
      .toEqual({ op: 'delete' });
  });
});
```

Run: `npx vitest run lib/apps/setEntitlement.test.ts` → Expected: FAIL (moduł nie istnieje)

- [ ] **Step 2: Utwórz `lib/apps/setEntitlement.ts`** (kopia 1:1 z BBS)

```ts
import { APPS, type AppId } from '@/lib/apps/registry';
import type { Role } from '@/types/enums';

export function resolveEntitlementWrite(
  role: Role,
  _current: { app_id: AppId; effect: 'grant' | 'revoke' }[],
  appId: AppId,
  desiredVisible: boolean,
): { op: 'delete' } | { op: 'upsert'; effect: 'grant' | 'revoke' } {
  const isDefault = APPS.find(a => a.id === appId)?.defaultRoles.includes(role) ?? false;
  if (desiredVisible === isDefault) return { op: 'delete' };
  return { op: 'upsert', effect: desiredVisible ? 'grant' : 'revoke' };
}
```

Run: `npx vitest run lib/apps/setEntitlement.test.ts` → Expected: 4 passed

- [ ] **Step 3: Utwórz `lib/apps/getEntitlements.ts`** (kopia 1:1 z BBS)

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Entitlement } from '@/types/entitlement';
import { isAppId } from '@/lib/apps/registry';

/** Pobiera wyjątki uprawnień użytkownika (grant/revoke) z Supabase. Brak/błąd → []. */
export async function getEntitlements(supabase: SupabaseClient, userId: string): Promise<Entitlement[]> {
  const { data, error } = await supabase
    .from('user_app_entitlements')
    .select('app_id, effect')
    .eq('user_id', userId);
  if (error || !data) return [];
  return data
    .filter((r) => isAppId(r.app_id) && (r.effect === 'grant' || r.effect === 'revoke'))
    .map((r) => ({ app_id: r.app_id, effect: r.effect }) as Entitlement);
}
```

- [ ] **Step 4: Utwórz `lib/apps/getViewerApps.ts`** (adaptacja z BBS: `DbRole` z `@/lib/roleMap`; nieznana rola → `Role.EMPLOYEE`)

```ts
// ── getViewerApps ─────────────────────────────────────────────────────────────
// Wspólny helper serwerowy dla stron shell: sesja + rola + dostęp do appek.
// Używany przez (shell)/layout.tsx ORAZ strony shell — bez duplikacji.

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Database } from '@/types/database';
import { DB_TO_ROLE, type DbRole } from '@/lib/roleMap';
import { Role } from '@/types/enums';
import { appsForUser } from '@/lib/apps/access';
import { getEntitlements } from '@/lib/apps/getEntitlements';
import type { AppId } from '@/lib/apps/registry';

export interface ViewerApps {
  userId: string;
  role: Role;
  apps: AppId[];
}

export async function getViewerApps(): Promise<ViewerApps> {
  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const cookieStore = await cookies();

  // Klient SSR — walidacja sesji z ciasteczek
  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Service role — odczyt user_profiles i entitlements z pominięciem RLS
  const admin = createClient<Database>(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const dbRole = profile?.role as DbRole | undefined;
  const role   = (dbRole ? DB_TO_ROLE[dbRole] : undefined) ?? Role.EMPLOYEE; // nieznana rola → najbezpieczniej jak pracownik

  const entitlements = await getEntitlements(admin, user.id);
  const apps = appsForUser(role, entitlements);

  return { userId: user.id, role, apps };
}
```

- [ ] **Step 5: tsc + wszystkie testy**

Run: `npx tsc --noEmit` → 0 błędów
Run: `npx vitest run lib/apps` → Expected: access 8 + setEntitlement 4 passed

- [ ] **Step 6: Commit**

```bash
git add lib/apps/getEntitlements.ts lib/apps/setEntitlement.ts lib/apps/setEntitlement.test.ts lib/apps/getViewerApps.ts
git commit -m "feat(shell): getEntitlements + resolveEntitlementWrite + getViewerApps (serwer)"
```

---

### Task 5: `/api/auth/role` — redirect wg appek (jedyna zmiana w loginie)

**Files:**
- Modify: `app/api/auth/role/route.ts` (końcówka funkcji GET — po pobraniu profilu; reszta pliku, w tym console.logi diagnostyczne, BEZ zmian)

**Interfaces:**
- Consumes: `getEntitlements` (Task 4), `appsForUser` (Task 1), `resolvePostLogin` (Task 2).
- Produces: response `{ redirectUrl: string, apps: AppId[] }` — strona logowania (`app/(auth)/login/page.tsx`) czyta `redirectUrl` i NIE wymaga żadnych zmian.

- [ ] **Step 1: Dopisz importy na górze pliku**

```ts
import { appsForUser } from '@/lib/apps/access';
import { getEntitlements } from '@/lib/apps/getEntitlements';
import { resolvePostLogin } from '@/lib/auth/postLoginRedirect';
```

- [ ] **Step 2: Zamień KOŃCÓWKĘ funkcji GET.** Obecny kod (ostatnie 4 linie przed zamknięciem):

```ts
  const role       = DB_TO_ROLE[profile.role as DbRole];
  const redirectUrl = role ? ROLE_DASHBOARD[role] : '/dashboard/employee';

  console.log('[role] redirectUrl:', redirectUrl);
  return NextResponse.json({ redirectUrl });
```

Zamień na:

```ts
  const role = DB_TO_ROLE[profile.role as DbRole];

  // E1 shell: cel logowania zależy od liczby dostępnych appek
  // (1 appka → jej dashboard jak dotąd; >1 → /launcher). Fallback: stare zachowanie.
  let redirectUrl = role ? ROLE_DASHBOARD[role] : '/dashboard/employee';
  let apps: string[] = [];
  if (role) {
    const entitlements = await getEntitlements(admin, user.id);
    apps = appsForUser(role, entitlements);
    redirectUrl = resolvePostLogin(role, apps as Parameters<typeof resolvePostLogin>[1]);
  }

  console.log('[role] redirectUrl:', redirectUrl, '| apps:', apps);
  return NextResponse.json({ redirectUrl, apps });
```

> `admin` to istniejący w tym pliku klient service-role (`createClient(...)` kilka linii wyżej) — nie twórz drugiego.

- [ ] **Step 3: Weryfikacja zachowania (dev)**

Run: `npx tsc --noEmit` → 0 błędów.
Uruchom dev (`npx next dev --port 3010`), zaloguj się kontem `pracownik` z CLAUDE.md — oczekiwane: lądujesz na `/dashboard/employee` jak dotychczas (1 appka). Konto `superadmin` — `/dashboard/admin` (w E1 też ma tylko 1 appkę).

- [ ] **Step 4: Commit**

```bash
git add app/api/auth/role/route.ts
git commit -m "feat(auth): /api/auth/role kieruje wg dostepnych appek (1 -> dashboard, >1 -> launcher)"
```

---

### Task 6: Shell UI — layout, launcher, host `/app/[appId]`, `AppTile`, `TopBar` (branding EBS)

**Files:**
- Create: `app/(shell)/layout.tsx`
- Create: `app/(shell)/launcher/page.tsx`
- Create: `app/(shell)/app/[appId]/page.tsx`
- Create: `components/shell/AppTile.tsx`
- Create: `components/shell/TopBar.tsx`

**Interfaces:**
- Consumes: `getViewerApps` (Task 4), `APPS`/`isAppId`/`AppDef` (Task 1), `existingAppTarget` (Task 2). EBS ma w tailwind ramps `primary-*` (emerald) i `secondary-*` (indigo) — klasy zostają; `font-display` NIE istnieje w EBS → zamieniamy na `font-sans`. Logo: `/ebs-black.svg` + `filter: brightness(0) invert(1)` (konwencja EBS, patrz CLAUDE.md). Wylogowanie: `POST /api/auth/logout` (istnieje).
- Produces: trasy `/launcher`, `/app/[appId]`; komponenty `AppTile`, `TopBar` używane przez Task 7 (strona uprawnień korzysta z layoutu `(shell)`).

- [ ] **Step 1: Utwórz `components/shell/TopBar.tsx`** (adaptacja brandingu z BBS `components/shell/TopBar.tsx`)

```tsx
'use client';

import Link from 'next/link';
import { LayoutGrid, LogOut } from 'lucide-react';

export function TopBar() {
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <header
      className="sticky top-0 z-50 flex h-16 w-full flex-shrink-0 items-center justify-between
                 border-b border-white/10 px-5 sm:px-6 backdrop-blur-md"
      style={{ backgroundColor: 'rgba(6,14,10,.88)' }}
    >
      {/* Brand */}
      <Link href="/launcher" className="flex items-center gap-3 select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ebs-black.svg"
          alt=""
          className="h-8 w-auto"
          style={{ filter: 'brightness(0) invert(1)' }}
        />
        <span className="hidden font-sans text-base font-bold tracking-tight text-white sm:block">
          Eliton Benefits
          <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-300">
            System
          </span>
        </span>
      </Link>

      {/* Prawa strona */}
      <div className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/launcher"
          title="Wybierz aplikację"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/70
                     transition-colors hover:bg-white/5 hover:text-white"
        >
          <LayoutGrid size={18} />
          <span className="hidden sm:inline">Aplikacje</span>
        </Link>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-white/60
                     transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
        >
          <LogOut size={17} />
          <span className="hidden sm:inline">Wyloguj</span>
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Utwórz `components/shell/AppTile.tsx`** (adaptacja: opisy EBS, `Partial<Record>` na przyszłe appki, `font-display`→`font-sans`)

```tsx
import Link from 'next/link';
import { Gift, HardHat, FileText, MessageSquare, BookOpen, ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { AppDef, AppId } from '@/lib/apps/registry';

const ICON_MAP: Record<string, LucideIcon> = {
  'gift':     Gift,
  'hard-hat': HardHat,
  'file':     FileText,
  'chat':     MessageSquare,
  'book':     BookOpen,
};

// Krótkie opisy kafelków (Partial — przyszłe appki dopisują swoje w E2+)
const DESCRIPTIONS: Partial<Record<AppId, string>> = {
  benefity: 'Vouchery i benefity pracownicze w jednym miejscu.',
};

interface AppTileProps {
  app: AppDef;
}

export function AppTile({ app }: AppTileProps) {
  const Icon = ICON_MAP[app.icon] ?? Gift;

  return (
    <Link
      href={app.route}
      className="group relative flex flex-col gap-5 rounded-2xl p-7
                 border border-white/10 bg-white/[0.04]
                 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)]
                 transition-all duration-300 ease-out
                 hover:-translate-y-1.5 hover:border-primary-400/40 hover:bg-white/[0.06]
                 hover:shadow-[0_26px_60px_-24px_rgba(0,0,0,0.7)]"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-primary-400/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-400/25
                   transition-transform duration-300 group-hover:scale-105"
        style={{ background: 'linear-gradient(150deg, rgba(48,223,106,.16), rgba(48,223,106,.03))' }}
      >
        <Icon size={28} strokeWidth={1.7} className="text-primary-300" />
      </span>

      <div>
        <h3 className="font-sans text-lg font-bold tracking-tight text-white">
          {app.name}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">
          {DESCRIPTIONS[app.id] ?? ''}
        </p>
      </div>

      <span className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-300/80 transition-colors group-hover:text-secondary-500">
        Otwórz
        <ArrowUpRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );
}
```

- [ ] **Step 3: Utwórz `app/(shell)/layout.tsx`** (tło: czerń EBS + zielona poświata #30df6a zamiast granatu BBS)

```tsx
// ── Shell layout (server component) ──────────────────────────────────────────
// Otacza wszystkie strony shell: weryfikuje sesję, renderuje TopBar.

import { getViewerApps } from '@/lib/apps/getViewerApps';
import { TopBar } from '@/components/shell/TopBar';
import type { ReactNode } from 'react';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  // Przekieruje na /login gdy brak sesji
  await getViewerApps();

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{
        background:
          'radial-gradient(1200px 600px at 80% -10%, rgba(48,223,106,.10), transparent 60%),' +
          'linear-gradient(165deg, #050807 0%, #0a1410 62%, #0d1f16 100%)',
      }}
    >
      <TopBar />
      <main className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Utwórz `app/(shell)/launcher/page.tsx`** (copy BBS: tylko teksty na EBS)

```tsx
// ── Launcher (server component) ───────────────────────────────────────────────
// Siatka aplikacji dostępnych dla zalogowanego użytkownika.

import { getViewerApps } from '@/lib/apps/getViewerApps';
import { AppTile } from '@/components/shell/AppTile';
import { APPS } from '@/lib/apps/registry';

export const metadata = { title: 'Aplikacje — Eliton Benefits System' };

export default async function LauncherPage() {
  const { apps } = await getViewerApps();

  const visibleApps = APPS.filter(a => apps.includes(a.id));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-14 sm:py-20">
      <header className="mb-10 sm:mb-12">
        <span className="inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.2em] text-secondary-500">
          <span className="h-px w-7 bg-secondary-500" />
          Platforma
        </span>
        <h1 className="mt-4 font-sans text-3xl font-extrabold tracking-tight text-white sm:text-[34px]">
          Wybierz aplikację
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/55">
          Masz dostęp do poniższych modułów Eliton Benefits. Wybierz, z którym chcesz teraz pracować.
        </p>
      </header>

      {visibleApps.length === 0 ? (
        <p className="text-sm text-white/50">
          Nie masz dostępu do żadnej aplikacji. Skontaktuj się z administratorem.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visibleApps.map(app => (
            <AppTile key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Utwórz `app/(shell)/app/[appId]/page.tsx`** (copy BBS 1:1 — guard + redirect per rola + placeholder)

```tsx
// ── Host aplikacji (server component) ─────────────────────────────────────────
// Pilnuje dostępu per appka; istniejące dashboardy → redirect wg roli; inaczej placeholder.

import { notFound, redirect } from 'next/navigation';
import { getViewerApps } from '@/lib/apps/getViewerApps';
import { isAppId, APPS } from '@/lib/apps/registry';
import { existingAppTarget } from '@/lib/apps/appTargets';

interface Props {
  params: Promise<{ appId: string }>;
}

export default async function AppPage({ params }: Props) {
  const { appId } = await params;

  if (!isAppId(appId)) {
    notFound();
  }

  const { apps, role } = await getViewerApps();
  if (!apps.includes(appId)) {
    redirect('/launcher');
  }

  // Appki obsługiwane przez istniejące dashboardy EBS → przekieruj wg roli
  const target = existingAppTarget(appId, role);
  if (target) {
    redirect(target);
  }

  const appDef = APPS.find(a => a.id === appId)!;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-white text-3xl font-bold mb-4">
        {appDef.name}
      </h1>
      <p className="text-white/50 text-base max-w-md">
        Moduł w budowie — dochodzi w kolejnym etapie migracji.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Weryfikacja**

Run: `npx tsc --noEmit` → 0 błędów.
Dev: wejdź na `http://localhost:3010/launcher` zalogowany jako superadmin — widzisz TopBar EBS + 1 kafelek „Benefity"; klik → `/dashboard/admin`. Bez sesji `/launcher` → redirect `/login` (middleware EBS traktuje wszystko poza PUBLIC_PATHS jako chronione — zmiany w middleware NIE są potrzebne).
Konto `pracownik`: `/app/benefity` → redirect `/dashboard/employee`; `/app/agencja` → 404 (nie zarejestrowana).

- [ ] **Step 7: Commit**

```bash
git add "app/(shell)" components/shell/TopBar.tsx components/shell/AppTile.tsx
git commit -m "feat(shell): launcher + host /app/[appId] + TopBar/AppTile (branding EBS)"
```

---

### Task 7: `/api/admin/entitlements` + `EntitlementsPanel` + strona `/admin/uprawnienia` + Sidebar

**Files:**
- Create: `app/api/admin/entitlements/route.ts`
- Create: `components/shell/EntitlementsPanel.tsx` (kopia z BBS + wskazane edycje)
- Create: `app/(shell)/admin/uprawnienia/page.tsx`
- Modify: `components/Sidebar.tsx` (menu SUPERADMIN, linie ~42-51)
- Modify: `app/dashboard/_components/AdminDashboardClient.tsx` (obsługa widoku `admin-uprawnienia`)

**Interfaces:**
- Consumes: Taski 1–4 (`registry`, `access`, `setEntitlement`, `getViewerApps`), EBS `lib/roleMap` (`DB_TO_ROLE`, `DbRole`), `Database` z `@/types/database`.
- Produces: `GET /api/admin/entitlements` → `{ users: [{id, full_name, role, apps, entitlements}] }`; `POST` body `{user_id, app_id, desiredVisible}` → `{ok, apps}`. Panel fetchuje dokładnie te kształty.

- [ ] **Step 1: Utwórz `app/api/admin/entitlements/route.ts`** — skopiuj plik **1:1** z `C:\Users\Użytkownik\Desktop\BBS-Unified\app\api\admin\entitlements\route.ts`, następnie zmień WYŁĄCZNIE linię importu typów:

```ts
// BBS:  import type { DbRole, Database } from '@/types/database';
// EBS ma DbRole w lib/roleMap, Database w types/database:
import type { Database } from '@/types/database';
import type { DbRole } from '@/lib/roleMap';
```

(reszta pliku — `validateSuperadmin`, `GET`, `POST` — działa w EBS bez zmian: używa `DB_TO_ROLE`, `Role.SUPERADMIN`, `isAppId`, `appsForUser`, `resolveEntitlementWrite`, wszystkie istnieją po Taskach 1–4).

- [ ] **Step 2: Utwórz `components/shell/EntitlementsPanel.tsx`** — skopiuj **1:1** z `C:\Users\Użytkownik\Desktop\BBS-Unified\components\shell\EntitlementsPanel.tsx`, następnie zamień blok `ROLE_LABEL` (w BBS klucze angielskie i role BBS) na role DB EBS:

```ts
// ── Etykiety ról (wartości z user_profiles.role w EBS) ───────────────────────
const ROLE_LABEL: Record<string, string> = {
  superadmin: 'Administrator',
  pracodawca: 'Pracodawca',
  pracownik:  'Pracownik',
  partner:    'Doradca',
  menedzer:   'Manager',
  dyrektor:   'Dyrektor',
};
```

Pozostałe ewentualne błędy `tsc` w tym pliku naprawiaj wg zasad: importy `@/lib/apps/*` zostają (istnieją po Task 1), klasy Tailwind zostają (ciemny panel na ciemnej stronie), `font-display` → `font-sans` jeśli występuje.

- [ ] **Step 3: Utwórz `app/(shell)/admin/uprawnienia/page.tsx`**

```tsx
// ── /admin/uprawnienia — tylko superadmin ─────────────────────────────────────
import { redirect } from 'next/navigation';
import { getViewerApps } from '@/lib/apps/getViewerApps';
import { Role } from '@/types/enums';
import { EntitlementsPanel } from '@/components/shell/EntitlementsPanel';

export const metadata = { title: 'Uprawnienia użytkowników — Eliton Benefits System' };

export default async function UprawnieniaSuperadminPage() {
  const { role } = await getViewerApps();

  if (role !== Role.SUPERADMIN) {
    redirect('/launcher');
  }

  return (
    <div className="flex-1 p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-white mb-6">
        Uprawnienia użytkowników
      </h1>
      <EntitlementsPanel />
    </div>
  );
}
```

- [ ] **Step 4: Sidebar — dodaj pozycję.** W `components/Sidebar.tsx`, w tablicy `case Role.SUPERADMIN:` (po pozycji `admin-logi`, linia ~50) dodaj:

```tsx
          { id: 'admin-uprawnienia', label: 'Uprawnienia', icon: <ShieldCheck size={20} /> },
```

i dopisz `ShieldCheck` do istniejącego importu z `lucide-react`.

- [ ] **Step 5: AdminDashboardClient — nawigacja do strony shell.** W `app/dashboard/_components/AdminDashboardClient.tsx` (stan `currentView`, linia ~20) dodaj funkcję i użyj jej we WSZYSTKICH trzech miejscach, gdzie przekazywany jest `setCurrentView` (linie ~56, ~63-64, ~141-142):

```tsx
  // 'admin-uprawnienia' to osobna strona shell (/admin/uprawnienia), nie tab admina
  const handleViewChange = (view: string) => {
    if (view === 'admin-uprawnienia') { window.location.href = '/admin/uprawnienia'; return; }
    setCurrentView(view);
  };
```

Zamiany: `onNavigate={(view) => { setCurrentView(view); setSearchOpen(false); }}` → `onNavigate={(view) => { handleViewChange(view); setSearchOpen(false); }}`; `onChangeView={setCurrentView}` → `onChangeView={handleViewChange}`; `onViewChange={setCurrentView}` → `onViewChange={handleViewChange}`.

- [ ] **Step 6: Weryfikacja**

Run: `npx tsc --noEmit` → 0 błędów.
Dev, superadmin: sidebar ma „Uprawnienia" → klik → `/admin/uprawnienia` (ciemna strona shell) → lista userów z toggle'ami appki „Benefity". Wyłącz „Benefity" testowemu pracownikowi → w tabeli `user_app_entitlements` pojawia się wiersz `revoke` (sprawdź MCP `execute_sql`: `SELECT * FROM user_app_entitlements;`). Włącz z powrotem → wiersz znika (op delete). Zaloguj się jako pracodawca i wejdź ręcznie na `/admin/uprawnienia` → redirect `/launcher`.

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/entitlements/route.ts components/shell/EntitlementsPanel.tsx "app/(shell)/admin" components/Sidebar.tsx app/dashboard/_components/AdminDashboardClient.tsx
git commit -m "feat(admin): panel Uprawnienia (entitlements per appka) + pozycja w sidebarze"
```

---

### Task 8: Fundament szczegółowych uprawnień: registry + server + 3 endpointy

**Files:**
- Create: `lib/permissions/registry.ts`
- Create: `lib/permissions/server.ts`
- Create: `lib/adminViews.ts`
- Create: `app/api/me/permissions/route.ts`
- Create: `app/api/permissions/roles/route.ts`
- Create: `app/api/permissions/user-overrides/route.ts`
- Create: `app/api/admin/view-config/route.ts`
- Test: `lib/permissions/registry.test.ts`

**Interfaces:**
- Consumes: `supabaseServer()` z `@/lib/supabase` (service-role), `getAuthUserWithRole()` z `@/lib/apiAuth` (zwraca `{id, email, role: string(DB), companyId?}` — **brak** `isOwner`/`dbRole` z BBS; bramka = `auth.role === 'superadmin'`), tabele z Task 3.
- Produces: `PERMISSION_GROUPS`, `ALL_PERMISSIONS`, `DEFAULT_ROLE_PERMS` (registry); `getEffectivePermissions(userId, role): Promise<Set<string>>`, `can(auth, perm)`, `canAny(auth, perms)` (server); `ADMIN_VIEWS`, `ADMIN_VIEW_IDS` (adminViews); endpointy REST jak niżej. Konsument UI dojdzie w E2 (dynamiczne menu) — w E1 endpointy są fundamentem + narzędziem via API.

- [ ] **Step 1: Failing test `lib/permissions/registry.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { ALL_PERMISSIONS, PERMISSION_GROUPS, DEFAULT_ROLE_PERMS } from './registry';

describe('permissions registry (EBS E1)', () => {
  it('klucze unikalne', () => {
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
  });
  it('bez kluczy CRM (wykluczony moduł)', () => {
    expect(ALL_PERMISSIONS.some(k => k.startsWith('crm.'))).toBe(false);
  });
  it('DEFAULT_ROLE_PERMS odwołuje się tylko do istniejących kluczy', () => {
    const all = new Set(ALL_PERMISSIONS);
    for (const perms of Object.values(DEFAULT_ROLE_PERMS)) {
      for (const p of perms) expect(all.has(p)).toBe(true);
    }
  });
  it('grupy: Panel systemowy i Benefity', () => {
    expect(PERMISSION_GROUPS.map(g => g.name)).toEqual(['Panel systemowy', 'Benefity']);
  });
});
```

Run: `npx vitest run lib/permissions/registry.test.ts` → FAIL (moduł nie istnieje)

- [ ] **Step 2: Utwórz `lib/permissions/registry.ts`** (wzór BBS przycięty do modułów EBS; klucze `benefity.*` odpowiadają zakładkom adminNew EBS)

```ts
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
```

Run: `npx vitest run lib/permissions/registry.test.ts` → 4 passed

- [ ] **Step 3: Utwórz `lib/permissions/server.ts`** (wzór BBS; `admin()` → `supabaseServer()`; bez syncAgency — E2)

```ts
// Serwerowe sprawdzanie uprawnień (macierz w DB + defaulty z registry).
// superadmin ZAWSZE ma wszystko — nie da się go ograniczyć z panelu.
// Efektywne uprawnienia = (role_permissions jeśli rola customized, inaczej DEFAULT_ROLE_PERMS)
//                        + wyjątki user_permissions (grant/revoke).
import { supabaseServer } from '@/lib/supabase';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMS } from './registry';

export interface AuthLike { id: string; role: string }

export async function getEffectivePermissions(userId: string | null, role: string): Promise<Set<string>> {
  if (role === 'superadmin') return new Set(ALL_PERMISSIONS);
  const sb = supabaseServer() as any;
  const [roleRow, rolePerms, userPerms] = await Promise.all([
    sb.from('app_roles').select('customized').eq('role', role).maybeSingle(),
    sb.from('role_permissions').select('permission').eq('role', role),
    userId ? sb.from('user_permissions').select('permission, effect').eq('user_id', userId) : Promise.resolve({ data: [] as any[] }),
  ]);

  const base = roleRow.data?.customized
    ? (rolePerms.data ?? []).map((r: any) => r.permission)
    : (DEFAULT_ROLE_PERMS[role] ?? []);

  const set = new Set<string>(base);
  for (const u of (userPerms.data ?? []) as { permission: string; effect: string }[]) {
    if (u.effect === 'revoke') set.delete(u.permission);
    else set.add(u.permission);
  }
  return set;
}

export async function can(auth: AuthLike, permission: string): Promise<boolean> {
  if (auth.role === 'superadmin') return true;
  const perms = await getEffectivePermissions(auth.id, auth.role);
  return perms.has(permission);
}

export async function canAny(auth: AuthLike, permissions: string[]): Promise<boolean> {
  if (auth.role === 'superadmin') return true;
  const perms = await getEffectivePermissions(auth.id, auth.role);
  return permissions.some(p => perms.has(p));
}
```

- [ ] **Step 4: Utwórz `lib/adminViews.ts`** (katalog widoków panelu admina EBS — pod view-config)

```ts
// Katalog widoków panelu admina EBS (dla admin_view_config).
// Id = id zakładek Sidebar/DashboardAdminNew.
export interface AdminViewDef { id: string; label: string }

export const ADMIN_VIEWS: AdminViewDef[] = [
  { id: 'admin-pulpit',      label: 'Pulpit' },
  { id: 'admin-klienci',     label: 'Baza klientów' },
  { id: 'admin-platnosci',   label: 'Płatności i faktury' },
  { id: 'admin-archiwum',    label: 'Archiwum' },
  { id: 'admin-vouchery',    label: 'Vouchery' },
  { id: 'admin-buyback',     label: 'Anulowanie subskrypcji' },
  { id: 'admin-szablony',    label: 'Szablony dokumentów' },
  { id: 'admin-logi',        label: 'Logi systemowe' },
  { id: 'admin-uprawnienia', label: 'Uprawnienia' },
];

export const ADMIN_VIEW_IDS = new Set(ADMIN_VIEWS.map(v => v.id));
```

- [ ] **Step 5: Utwórz `app/api/me/permissions/route.ts`** (wzór BBS, bez `isOwner`/`dbRole`)

```ts
// GET /api/me/permissions — efektywne uprawnienia zalogowanego (fundament pod dynamiczne menu w E2)
import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { getEffectivePermissions } from '@/lib/permissions/server';
import { supabaseServer } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [perms, roleRow] = await Promise.all([
    getEffectivePermissions(auth.id, auth.role),
    (supabaseServer() as any).from('app_roles').select('label').eq('role', auth.role).maybeSingle(),
  ]);
  return NextResponse.json({
    role: auth.role,
    role_label: roleRow.data?.label ?? null,
    permissions: [...perms],
  });
}
```

- [ ] **Step 6: Utwórz `app/api/permissions/roles/route.ts`** (wzór BBS; bramka superadmin; bez syncAgency i bez `owner`)

```ts
// GET  /api/permissions/roles — role + ich uprawnienia (custom lub defaulty) + liczba userów
// POST — nowa rola własna (startuje bez uprawnień)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMS } from '@/lib/permissions/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza uprawnieniami' }, { status: 403 });
  const sb = supabaseServer() as any;
  const [roles, perms, profiles] = await Promise.all([
    sb.from('app_roles').select('*').order('is_system', { ascending: false }).order('label'),
    sb.from('role_permissions').select('role, permission'),
    sb.from('user_profiles').select('role'),
  ]);
  if (roles.error) return NextResponse.json({ error: roles.error.message }, { status: 500 });

  const permMap = new Map<string, string[]>();
  for (const p of perms.data ?? []) {
    if (!permMap.has(p.role)) permMap.set(p.role, []);
    permMap.get(p.role)!.push(p.permission);
  }
  const countMap = new Map<string, number>();
  for (const p of profiles.data ?? []) countMap.set(p.role, (countMap.get(p.role) || 0) + 1);

  const out = (roles.data ?? []).map((r: any) => ({
    ...r,
    permissions: r.role === 'superadmin' ? ALL_PERMISSIONS
      : r.customized ? (permMap.get(r.role) ?? [])
      : (DEFAULT_ROLE_PERMS[r.role] ?? []),
    locked: r.role === 'superadmin',
    users_count: countMap.get(r.role) || 0,
  }));
  return NextResponse.json({ roles: out });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza uprawnieniami' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const label = String(b.label || '').trim();
  if (label.length < 2) return NextResponse.json({ error: 'Podaj nazwę roli (min. 2 znaki)' }, { status: 400 });

  // klucz roli: bez polskich znaków, lowercase, podkreślenia
  const key = label.toLowerCase()
    .replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!key) return NextResponse.json({ error: 'Nieprawidłowa nazwa' }, { status: 400 });

  const { data, error } = await (supabaseServer() as any).from('app_roles')
    .insert({ role: key, label, is_system: false, customized: true })
    .select().single();
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: `Rola „${key}" już istnieje` }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}
```

- [ ] **Step 7: Utwórz `app/api/permissions/user-overrides/route.ts`** (wzór BBS; bramka superadmin; bez `logEvent` — audyt robią triggery DB z Task 3)

```ts
// GET    /api/permissions/user-overrides — lista wyjątków per użytkownik (z nazwiskami)
// POST   {user_id, permission, effect: grant|revoke} — dodaj/zmień wyjątek
// DELETE ?userId=&permission= — usuń wyjątek
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { ALL_PERMISSIONS } from '@/lib/permissions/registry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza uprawnieniami' }, { status: 403 });
  const sb = supabaseServer() as any;
  const [ov, profiles] = await Promise.all([
    sb.from('user_permissions').select('*').order('created_at', { ascending: false }),
    sb.from('user_profiles').select('id, full_name, role'),
  ]);
  if (ov.error) return NextResponse.json({ error: ov.error.message }, { status: 500 });
  const pMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
  const overrides = (ov.data ?? []).map((o: any) => ({
    ...o,
    user_name: (pMap.get(o.user_id) as any)?.full_name ?? o.user_id,
    user_role: (pMap.get(o.user_id) as any)?.role ?? null,
  }));
  return NextResponse.json({ overrides });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza uprawnieniami' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (!b.user_id || !ALL_PERMISSIONS.includes(b.permission)) return NextResponse.json({ error: 'Brak użytkownika lub nieprawidłowe uprawnienie' }, { status: 400 });
  const effect = b.effect === 'revoke' ? 'revoke' : 'grant';
  const { error } = await (supabaseServer() as any).from('user_permissions')
    .upsert({ user_id: b.user_id, permission: b.permission, effect }, { onConflict: 'user_id,permission' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza uprawnieniami' }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const permission = searchParams.get('permission');
  if (!userId || !permission) return NextResponse.json({ error: 'Brak danych' }, { status: 400 });
  const { error } = await (supabaseServer() as any).from('user_permissions').delete().eq('user_id', userId).eq('permission', permission);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 8: Utwórz `app/api/admin/view-config/route.ts`** (wzór BBS; bramka superadmin; `isUuid` inline — chroni przed dev-owym id `dev-vite`)

```ts
// Konfiguracja WIDOKU per rola — które zakładki panelu widzi dana rola.
//   • GET            — { hidden: string[] } dla ROLI wołającego (superadmin → puste).
//   • GET ?manage=1  — (superadmin) katalog widoków + role + mapa ukrytych per rola.
//   • POST           — (superadmin) { role, hidden: string[] }.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { ADMIN_VIEWS, ADMIN_VIEW_IDS } from '@/lib/adminViews';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function GET(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const sb = supabaseServer() as any;

  if (new URL(request.url).searchParams.get('manage') === '1') {
    if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin' }, { status: 403 });
    const [{ data: cfg }, { data: roles }] = await Promise.all([
      sb.from('admin_view_config').select('role, view_id, hidden'),
      sb.from('app_roles').select('role, label').order('is_system', { ascending: false }).order('label'),
    ]);
    const hiddenByRole: Record<string, string[]> = {};
    for (const r of cfg || []) { if ((r as any).hidden && ADMIN_VIEW_IDS.has((r as any).view_id)) (hiddenByRole[(r as any).role] ||= []).push((r as any).view_id); }
    return NextResponse.json({
      catalog: ADMIN_VIEWS,
      roles: (roles || []).filter((r: any) => r.role !== 'superadmin').map((r: any) => ({ role: r.role, label: r.label || r.role })),
      hidden_by_role: hiddenByRole,
    });
  }

  const hidden = auth.role === 'superadmin' ? [] : ((await sb.from('admin_view_config').select('view_id, hidden').eq('role', auth.role))
    .data?.filter((r: any) => r.hidden).map((r: any) => r.view_id) ?? []);
  return NextResponse.json({ hidden });
}

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'superadmin') return NextResponse.json({ error: 'Tylko superadmin zarządza widokiem ról' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  const role = String(b.role || '').trim();
  if (!role || role === 'superadmin') return NextResponse.json({ error: 'Wskaż rolę (superadmin nieedytowalny)' }, { status: 400 });
  const hidden: string[] = Array.isArray(b.hidden) ? b.hidden.filter((v: any) => ADMIN_VIEW_IDS.has(v)) : [];
  const sb = supabaseServer() as any;
  const uid = isUuid(auth.id) ? auth.id : null;
  const rows = ADMIN_VIEWS.map(v => ({
    role, view_id: v.id, label: v.label, hidden: hidden.includes(v.id),
    updated_by: uid, updated_at: new Date().toISOString(),
  }));
  const { error } = await sb.from('admin_view_config').upsert(rows, { onConflict: 'role,view_id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, role, hidden });
}
```

- [ ] **Step 9: Weryfikacja**

Run: `npx vitest run lib/permissions/registry.test.ts` → 4 passed
Run: `npx tsc --noEmit` → 0 błędów
Dev: `curl -s http://localhost:3010/api/me/permissions` bez sesji → 401. Zalogowany superadmin (przeglądarka): `/api/me/permissions` → `permissions` = wszystkie klucze; `/api/permissions/roles` → 6 ról z seedu.

- [ ] **Step 10: Commit**

```bash
git add lib/permissions lib/adminViews.ts app/api/me/permissions app/api/permissions app/api/admin/view-config lib/permissions/registry.test.ts
git commit -m "feat(permissions): rejestr + macierz efektywnych uprawnien + endpointy roles/user-overrides/view-config"
```

---

### Task 9: Skrypt importu definicji ról/uprawnień z bazy BBS

**Files:**
- Create: `scripts/import-bbs-permissions.mts`

**Interfaces:**
- Consumes: tabele `app_roles`, `role_permissions` w OBU bazach; źródłowe kredencjały z pliku `C:\Users\Użytkownik\Desktop\BBS-Unified\.env.local` (parsowane), docelowe z EBS `.env.local` (`--env-file`).
- Produces: w bazie EBS — role własne z BBS (`customized=true`) + ich `role_permissions` bez kluczy `crm.*`.

- [ ] **Step 1: Utwórz `scripts/import-bbs-permissions.mts`**

```ts
/**
 * Jednorazowy import definicji ról i uprawnień z bazy BBS do EBS (decyzja E1).
 * Kopiuje: app_roles (role własne, customized) + role_permissions BEZ kluczy crm.*
 * (CRM wykluczony; klucze agencja.*/ksiegowosc.* zostają — użyją ich E2/E4).
 * NIE kopiuje user_permissions (ID userów różnią się między systemami)
 * ani admin_view_config (katalogi widoków BBS ≠ EBS).
 *
 * Uruchom:  npx tsx --env-file=.env.local scripts/import-bbs-permissions.mts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const BBS_ENV_PATH = 'C:/Users/Użytkownik/Desktop/BBS-Unified/.env.local';

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, '').trim();
  }
  return out;
}

const bbsEnv = parseEnvFile(BBS_ENV_PATH);
const src = createClient(bbsEnv.NEXT_PUBLIC_SUPABASE_URL ?? '', bbsEnv.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } });
const dst = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } });

if (!bbsEnv.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.error('Brak kredencjałów (BBS .env.local lub EBS .env.local)'); process.exit(1);
}

// 1) app_roles — tylko role własne (customized) + systemowe nieznane w EBS pomijamy
const { data: roles, error: rolesErr } = await src.from('app_roles').select('*');
if (rolesErr) { console.error('BBS app_roles:', rolesErr.message); process.exit(1); }
const customRoles = (roles ?? []).filter((r: any) => r.customized && r.role !== 'owner');
for (const r of customRoles) {
  const { error } = await dst.from('app_roles')
    .upsert({ role: r.role, label: r.label, is_system: false, customized: true }, { onConflict: 'role' });
  console.log(error ? `✗ rola ${r.role}: ${error.message}` : `✓ rola ${r.role} (${r.label})`);
}

// 2) role_permissions — dla przeniesionych ról, bez kluczy crm.*
const roleKeys = customRoles.map((r: any) => r.role);
if (roleKeys.length) {
  const { data: perms, error: permsErr } = await src.from('role_permissions').select('*').in('role', roleKeys);
  if (permsErr) { console.error('BBS role_permissions:', permsErr.message); process.exit(1); }
  const filtered = (perms ?? []).filter((p: any) => !String(p.permission).startsWith('crm.'));
  let ok = 0, fail = 0;
  for (const p of filtered) {
    const { error } = await dst.from('role_permissions')
      .upsert({ role: p.role, permission: p.permission }, { onConflict: 'role,permission' });
    if (error) { fail++; console.error(`✗ ${p.role}/${p.permission}:`, error.message); } else ok++;
  }
  console.log(`role_permissions: ${ok} skopiowane, ${fail} błędów (crm.* odfiltrowane: ${(perms ?? []).length - filtered.length})`);
} else {
  console.log('Brak ról własnych w BBS — nic do skopiowania.');
}
console.log('Gotowe.');
```

- [ ] **Step 2: Uruchom import**

Run: `npx tsx --env-file=.env.local scripts/import-bbs-permissions.mts`
Expected: log `✓ rola ...` dla każdej roli własnej BBS (np. `szef_koordynatorow`, `ksiegowa`, `leadowiec` — ile faktycznie jest) + podsumowanie `role_permissions`. Jeśli BBS nie ma ról własnych — komunikat „Brak ról własnych" (też OK).

- [ ] **Step 3: Weryfikacja w bazie EBS** (MCP `execute_sql`)

```sql
SELECT role, label, customized FROM app_roles ORDER BY is_system DESC, role;
SELECT role, count(*) FROM role_permissions GROUP BY role;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/import-bbs-permissions.mts
git commit -m "chore(scripts): import definicji rol/uprawnien z bazy BBS (bez crm.*)"
```

---

### Task 10: Weryfikacja końcowa + merge + deploy + smoke na produkcji

**Files:**
- Modify: `CLAUDE.md` (dopisek o E1 — sekcja architektury)

**Interfaces:** brak nowych — task domykający.

- [ ] **Step 1: Pełny zestaw testów + typy**

Run: `npx vitest run` → Expected: wszystkie testy pass (dotychczasowe fakturownia/mailer + nowe: access 8, setEntitlement 4, postLoginRedirect 11, registry 4).
Run: `npx tsc --noEmit` → 0 błędów.

- [ ] **Step 2: Dopisz do `CLAUDE.md`** — po sekcji „### Routing (Next.js App Router)" dodaj:

```markdown
### Shell / Launcher (E1, port z BBS-Unified — 2026-07-16)

Architektura super-appa: `/launcher` (kafelki appek), `/app/[appId]` (host z guardem),
`/admin/uprawnienia` (panel entitlements, superadmin). Rejestr appek: `lib/apps/registry.ts`
(E1: tylko `benefity`; CRM wykluczony — osobny CRM Stratton Prime). Dostęp = defaultRoles
per appka + wyjątki `user_app_entitlements` (migracja 044). Po zalogowaniu `/api/auth/role`
kieruje: 1 appka → jej dashboard (zero zmiany UX), >1 → `/launcher` (`lib/auth/postLoginRedirect`).
Szczegółowe uprawnienia (fundament pod E2): `lib/permissions/*` + tabele `app_roles`/
`role_permissions`/`user_permissions`/`admin_view_config` (migracja 045); superadmin zawsze
ma wszystko. Spec: `docs/superpowers/specs/2026-07-16-e1-shell-launcher-design.md`.
```

```bash
git add CLAUDE.md
git commit -m "docs(claude): sekcja shell/launcher E1"
```

- [ ] **Step 3: Merge do main** (fast-forward jeśli możliwy)

```bash
git checkout main
git merge feat/e1-shell-launcher
git push origin main
```

- [ ] **Step 4: Deploy**

```bash
npx vercel --prod --yes
```
Expected: `readyState: READY`, alias `https://ebs.elitonbenefits.pl`.

- [ ] **Step 5: Smoke produkcyjny**

```bash
curl -s -o /dev/null -w "%{http_code}" https://ebs.elitonbenefits.pl/login          # 200
curl -s -o /dev/null -w "%{http_code}" https://ebs.elitonbenefits.pl/launcher       # 307 → /login (brak sesji)
curl -s -o /dev/null -w "%{http_code}" https://ebs.elitonbenefits.pl/api/admin/entitlements  # 401
curl -s -o /dev/null -w "%{http_code}" https://ebs.elitonbenefits.pl/api/me/permissions      # 401
```

Ręcznie (przeglądarka):
1. Login pracownikiem (konta w CLAUDE.md) → ląduje na `/dashboard/employee` — bez zmiany UX. ✅
2. Login superadminem → `/dashboard/admin`; w sidebarze „Uprawnienia" → `/admin/uprawnienia` — panel działa. ✅
3. `/launcher` (superadmin, ręcznie) → kafelek „Benefity". ✅

- [ ] **Step 6: Raport końcowy dla użytkownika** — co wdrożone, co świadomie pominięte (odstępstwa 1–4 z nagłówka), następny krok: E2 (agencja + HR + generator dokumentów).
