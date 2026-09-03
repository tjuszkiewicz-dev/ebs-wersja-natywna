// Polityka komunikatora: KTO Z KIM może rozmawiać. Czysta funkcja — bez I/O, pokryta testami.
// Projektowana od nowa (spec E6 K3): w BBS tabela chat_policy jest pusta, a logikę niesie
// tablica NON_STAFF_ROLES w kodzie, której role (klient, platnik…) nie odpowiadają EBS.
//
// Dwie warstwy dostępu (spec §4.2):
//   1. czy w ogóle masz komunikator → uprawnienie `komunikator.czat` (can() na każdym route'cie),
//   2. z kim wolno rozmawiać → TA funkcja.
//
// Definicja PO WYKLUCZENIU (decyzja usera D6, 2026-09-03: „cała nasza firma ma, tylko obcy nie"):
//   * EXTERNAL_ROLES — użytkownicy zewnętrzni portalu bonowego; nie dochodzą tu wcale
//     (odcięci uprawnieniem), ale funkcja i tak odmawia — bramka nie może polegać na UI.
//   * pracownik_tymczasowy — rozmawia WYŁĄCZNIE ze swoim koordynatorem (D3).
//   * każda inna rola, w tym własne z app_roles i `leadowiec` (którego w app_roles nie ma) —
//     personel wewnętrzny, bez ograniczeń między sobą.

export const EXTERNAL_ROLES: readonly string[] = ['pracodawca', 'pracownik'];
export const TEMP_WORKER_ROLE = 'pracownik_tymczasowy';

/** Role z pełnym dostępem niezależnie od macierzy (owner normalizuje się do superadmin w getAuthUserWithRole). */
const ALWAYS_ALLOWED: readonly string[] = ['superadmin', 'owner'];

export const isExternal = (role?: string | null): boolean => !!role && EXTERNAL_ROLES.includes(role);
export const isTempWorker = (role?: string | null): boolean => role === TEMP_WORKER_ROLE;
/** Personel wewnętrzny = nie-zewnętrzny i nie pracownik tymczasowy (rola pusta = nie personel). */
export const isStaff = (role?: string | null): boolean => !!role && !isExternal(role) && !isTempWorker(role);

/** Para ról posortowana alfabetycznie — tak trzyma ją chat_policy (role_a <= role_b). */
export const pairKey = (a: string, b: string): [string, string] => (a <= b ? [a, b] : [b, a]);

export interface ConverseCtx {
  /** id koordynatora pracownika tymczasowego (hr_employees.coordinator_id) — po stronie A i B */
  coordinatorOfA?: string | null;
  coordinatorOfB?: string | null;
  /** identyfikatory stron (potrzebne tylko do sprawdzenia „to mój koordynator") */
  idA?: string;
  idB?: string;
  /** pary zablokowane w chat_policy, w formacie `${role_a}|${role_b}` (posortowane) */
  blocked?: Set<string>;
}

/** `reason` jest ustawiony wtedy i tylko wtedy, gdy `ok === false`. (Zwykły interfejs zamiast unii
 *  dyskryminowanej — konfiguracja tsc w tym repo nie zawęża `!v.ok` do gałęzi z `reason`.) */
export interface ConverseVerdict { ok: boolean; reason?: string }

/**
 * Czy osoba A (rola roleA) może rozmawiać z osobą B (rola roleB).
 * Symetryczna względem zamiany stron (test tego pilnuje).
 */
export function canConverse(roleA: string | null | undefined, roleB: string | null | undefined, ctx: ConverseCtx = {}): ConverseVerdict {
  const a = roleA || '';
  const b = roleB || '';

  // superadmin/owner — zawsze (interwencje, testy, także z pracownikiem tymczasowym)
  if (ALWAYS_ALLOWED.includes(a) || ALWAYS_ALLOWED.includes(b)) return { ok: true };

  // użytkownicy zewnętrzni — nigdy
  if (isExternal(a) || isExternal(b)) return { ok: false, reason: 'Użytkownicy zewnętrzni nie mają komunikatora' };

  // pracownik tymczasowy — tylko ze swoim koordynatorem
  if (isTempWorker(a) || isTempWorker(b)) {
    if (isTempWorker(a) && isTempWorker(b)) return { ok: false, reason: 'Pracownicy tymczasowi nie rozmawiają ze sobą przez komunikator' };
    const workerIsA = isTempWorker(a);
    const coordinator = workerIsA ? ctx.coordinatorOfA : ctx.coordinatorOfB;
    const other = workerIsA ? ctx.idB : ctx.idA;
    if (!coordinator) return { ok: false, reason: 'Pracownik nie ma przypisanego koordynatora' };
    if (!other || coordinator !== other) return { ok: false, reason: 'Pracownik tymczasowy rozmawia tylko ze swoim koordynatorem' };
    return { ok: true };
  }

  // personel ↔ personel — dozwolone, chyba że właściciel zablokował parę ról
  if (!a || !b) return { ok: false, reason: 'Brak roli' };
  const [x, y] = pairKey(a, b);
  if (ctx.blocked?.has(`${x}|${y}`)) return { ok: false, reason: `Polityka komunikatora blokuje rozmowy ${x} ↔ ${y}` };
  return { ok: true };
}
