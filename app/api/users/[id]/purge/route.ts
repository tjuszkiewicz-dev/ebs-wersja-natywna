// ─────────────────────────────────────────────────────────────────────────────
// GET/DELETE /api/users/[id]/purge — usunięcie konta użytkownika.
// Wyłącznie dla właściciela (owner). OPERACJA NIEODWRACALNA.
//
// GET  — podsumowanie: jaki będzie TRYB, jaki jest ślad finansowy, co zniknie,
//        co zostanie i jaką frazę trzeba przepisać. Nic nie modyfikuje.
// DELETE — wykonanie, po potwierdzeniu frazą.
//
// DWA TRYBY (ustalane automatycznie, PRZED czymkolwiek niszczącym):
//   • ślad finansowy pusty   → PURGE: realne skasowanie konta logowania i profilu.
//   • ślad finansowy niepusty → ANONIMIZACJA: rekord zostaje (bo trzyma go księga
//     przez FK RESTRICT i trigger enforce_ledger_immutability), dane osobowe
//     wymazane, logowanie odcięte, KSIĘGA I DOKUMENTY FINANSOWE NIETKNIĘTE.
//
// Kod NIE JEST TRANSAKCYJNY (Supabase REST) — każdy krok jest idempotentny
// i wykonywany od najmniej do najbardziej niszczącego, żeby przerwanie w połowie
// dało się bezpiecznie ponowić.
//
// Logika decyzyjna (tryb, listy tabel, walidacja potwierdzenia) siedzi
// w `lib/users/accountPurge.ts` i jest pokryta testami jednostkowymi.
// ─────────────────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { isUuid } from '@/lib/uuid';
import {
  FINANCIAL_FOOTPRINT,
  OWNED_TABLES,
  DETACH_TABLES,
  DB_HANDLED,
  decideMode,
  footprintTotal,
  nonEmptyFootprint,
  expectedConfirmation,
  confirmationMatches,
  buildPlan,
  anonymizedEmail,
  anonymizedProfilePatch,
  isMissingAuthUserError,
  type PurgeMode,
} from '@/lib/users/accountPurge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface TargetProfile {
  id: string;
  full_name: string | null;
  role: string;
}

/**
 * Wspólne bramki bezpieczeństwa dla GET i DELETE.
 * Zwraca albo gotową odpowiedź błędu, albo namierzony profil + aktora.
 */
async function guard(
  id: string
): Promise<
  | { error: NextResponse }
  | { profile: TargetProfile; actor: { id: string; email: string } }
> {
  const auth = await getAuthUserWithRole();
  // Właściciel to jedyna rola, która może tu wejść — nie 'superadmin'.
  if (!auth?.isOwner) {
    return { error: NextResponse.json({ error: 'Tylko właściciel może usuwać konta' }, { status: 403 }) };
  }
  if (!isUuid(id)) {
    return { error: NextResponse.json({ error: 'Nieprawidłowy identyfikator' }, { status: 400 }) };
  }
  if (id === auth.id) {
    return { error: NextResponse.json({ error: 'Nie możesz usunąć własnego konta' }, { status: 400 }) };
  }

  const { data: profile, error } = await supabaseServer()
    .from('user_profiles')
    .select('id, full_name, role')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: `Błąd odczytu profilu: ${error.message}` }, { status: 500 }) };
  }
  if (!profile) {
    return { error: NextResponse.json({ error: 'Nie ma takiego użytkownika' }, { status: 404 }) };
  }
  // `types/database.ts` nie zna jeszcze roli 'owner' (dodana migracją 051) — stąd cast.
  if ((profile.role as string) === 'owner') {
    return { error: NextResponse.json({ error: 'Nie można usunąć konta właściciela' }, { status: 400 }) };
  }

  return {
    profile: profile as TargetProfile,
    actor: { id: auth.id, email: auth.email },
  };
}

/** Zlicza ślad finansowy. Błąd zapytania traktujemy jako „coś tam jest" (bezpieczniej). */
async function readFootprint(id: string): Promise<Record<string, number>> {
  const sb = supabaseServer() as any;
  const footprint: Record<string, number> = {};

  for (const ref of FINANCIAL_FOOTPRINT) {
    const key = `${ref.table}.${ref.column}`;
    const { count, error } = await sb
      .from(ref.table)
      .select('*', { count: 'exact', head: true })
      .eq(ref.column, id);

    // Nie potrafimy policzyć → NIE zakładamy zera. Zero uruchomiłoby PURGE,
    // a ten i tak wywaliłby się na FK — tylko po częściowym wykonaniu.
    footprint[key] = error ? 1 : (count ?? 0);
  }

  return footprint;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — podsumowanie. Właściciel widzi, co się stanie, ZANIM kliknie.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if ('error' in g) return g.error;

  const footprint = await readFootprint(id);
  const mode = decideMode(footprint);
  const plan = buildPlan(mode);

  return NextResponse.json({
    mode,
    footprint,
    footprintTotal: footprintTotal(footprint),
    footprintDetails: nonEmptyFootprint(footprint),
    owned: plan.deletes,
    detached: plan.detaches,
    kept: plan.keeps,
    dbHandled: DB_HANDLED,
    confirmPhrase: expectedConfirmation(g.profile),
    profile: { full_name: g.profile.full_name, role: g.profile.role },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// DELETE — wykonanie.
// ─────────────────────────────────────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if ('error' in g) return g.error;
  const { profile, actor } = g;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  if (!confirmationMatches(body?.confirm, profile)) {
    return NextResponse.json(
      { error: 'Potwierdzenie nie zgadza się z nazwą konta' },
      { status: 400 }
    );
  }

  // Tryb ustalamy PRZED czymkolwiek niszczącym.
  const footprint = await readFootprint(id);
  const mode: PurgeMode = decideMode(footprint);
  const plan = buildPlan(mode);

  const sb = supabaseServer();
  const dyn = sb as any;   // pętle po nazwach tabel (m.in. hr_* spoza types/database.ts)

  // ── Audyt PRZED operacją ───────────────────────────────────────────────────
  // Wyjątek od konwencji repo (normalnie audyt piszą triggery): po PURGE nie ma
  // już wiersza, z którego trigger mógłby cokolwiek odtworzyć, a operacja jest
  // nieodwracalna. Zapisujemy kto, kogo, w jakim trybie, jaki był ślad i plan.
  // Świadomie BEZ danych wrażliwych (PESEL, IBAN, adres) — wpis ma identyfikować
  // operację, nie konserwować danych, które właśnie kasujemy.
  const { error: auditError } = await dyn.from('audit_log').insert({
    table_name: 'user_profiles',
    operation: 'DELETE',
    row_id: id,
    changed_by: actor.id,
    old_data: { full_name: profile.full_name, role: profile.role },
    new_data: {
      action: 'usuniecie-konta',
      mode,
      actor_email: actor.email,
      footprint,
      footprint_total: footprintTotal(footprint),
      planned_deletes: plan.deletes,
      planned_detaches: plan.detaches,
      kept: plan.keeps,
    },
  });
  if (auditError) {
    // Bez śladu w audycie nie wykonujemy operacji nieodwracalnej.
    return NextResponse.json(
      { error: `Nie udało się zapisać wpisu audytowego — operacja przerwana: ${auditError.message}` },
      { status: 500 }
    );
  }

  const warnings: string[] = [];

  // ── Krok 1: odpięcia (najmniej niszczące) ──────────────────────────────────
  // Dane firmowe zostają, znika tylko wskazanie na usuwane konto.
  for (const ref of DETACH_TABLES) {
    const { error } = await dyn.from(ref.table).update({ [ref.column]: null }).eq(ref.column, id);
    if (error) warnings.push(`odpięcie ${ref.table}.${ref.column}: ${error.message}`);
  }

  // ── Krok 2: kasowanie rzeczy prywatnych konta ──────────────────────────────
  // W OBU trybach — konto zanonimizowane jest martwe, nie może zachować
  // żywych uprawnień ani przypisań.
  for (const ref of OWNED_TABLES) {
    const { error } = await dyn.from(ref.table).delete().eq(ref.column, id);
    if (error) warnings.push(`kasowanie ${ref.table}.${ref.column}: ${error.message}`);
  }

  if (mode === 'anonymize') {
    // ── Krok 3a: wymazanie danych osobowych; księga bez zmian ────────────────
    const now = new Date().toISOString();
    const { error: pErr } = await dyn
      .from('user_profiles')
      .update(anonymizedProfilePatch(now))
      .eq('id', id);
    if (pErr) {
      return NextResponse.json(
        { error: `Nie udało się zanonimizować profilu: ${pErr.message}`, warnings },
        { status: 500 }
      );
    }

    // ── Krok 4a: odcięcie logowania ──────────────────────────────────────────
    const { error: aErr } = await sb.auth.admin.updateUserById(id, {
      email: anonymizedEmail(id),
      password: crypto.randomUUID() + crypto.randomUUID(),
      ban_duration: '876000h',   // 100 lat — Supabase nie ma „na zawsze"
      user_metadata: {},
    } as any);
    if (aErr) {
      // Profil już zanonimizowany — zgłaszamy, bo konto logowania nadal żyje.
      return NextResponse.json(
        {
          error: `Profil zanonimizowany, ale nie udało się odciąć logowania: ${aErr.message}`,
          mode,
          warnings,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, mode, footprint, warnings });
  }

  // ── Krok 3b (PURGE): konto logowania PRZED profilem ────────────────────────
  // Odwrotna kolejność przy awarii zostawia konto logowania bez profilu —
  // użytkownik mógłby się zalogować donikąd.
  const { error: authErr } = await sb.auth.admin.deleteUser(id);
  if (authErr && !isMissingAuthUserError(authErr.message)) {
    return NextResponse.json(
      { error: `Nie udało się usunąć konta logowania: ${authErr.message}`, mode, warnings },
      { status: 500 }
    );
  }

  // ── Krok 4b: profil ────────────────────────────────────────────────────────
  // Kasowanie auth.users kaskaduje na user_profiles — ten krok to domknięcie
  // przypadku, w którym konta logowania już nie było (idempotencja).
  const { error: profErr } = await dyn.from('user_profiles').delete().eq('id', id);
  if (profErr) {
    return NextResponse.json(
      { error: `Konto logowania usunięte, ale profil został: ${profErr.message}`, mode, warnings },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, mode, footprint, warnings });
}
