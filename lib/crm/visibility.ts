// Widoczność leadów i kontaktów w CRM — port z BBS-Unified z adaptacjami EBS (E7a).
//
// Różnice względem oryginału (spec 2026-08-31-e7-crm-design.md, K1):
//   * `admin()` NIE jest tu odtwarzany — EBS ma już `lib/supabaseAdmin.admin`
//     (ten sam klient service-role). Reeksportujemy go, żeby ścieżki importu
//     z BBS działały bez przepisywania route'ów.
//   * Doszła gałąź `owner` — rola, której BBS nie zna. Bez niej właściciel
//     widziałby pusty CRM (ten sam błąd co w commicie a3c2bcf).
//   * `manager_id` dochodzi migracją 054; w BBS istniało od migracji 042.
import { admin } from '@/lib/supabaseAdmin';

/** Role z pełną widocznością — bez filtra po `assigned_to`. */
const FULL_VISIBILITY_ROLES = ['superadmin', 'owner', 'koordynator', 'szef_koordynatorow'];

/**
 * Zwraca zestaw user_id, których leady/kontakty widzi dany użytkownik.
 *
 * - superadmin / owner / koordynator / szef koordynatorów → null (brak filtra = wszystko)
 * - dyrektor → siebie + menedżerowie z manager_id = self + partnerzy pod tymi menedżerami
 * - menedzer → siebie + partnerzy z manager_id = self
 * - partner  → tylko siebie
 */
export async function getVisibleUserIds(
  callerId: string,
  callerRole: string,
): Promise<string[] | null> {
  if (FULL_VISIBILITY_ROLES.includes(callerRole)) return null;

  if (callerRole === 'partner') {
    return [callerId];
  }

  if (callerRole === 'menedzer') {
    const { data } = await (admin() as any)
      .from('user_profiles')
      .select('id')
      .eq('manager_id', callerId);
    const directReportIds = (data ?? []).map((u: any) => u.id);
    return [callerId, ...directReportIds];
  }

  if (callerRole === 'dyrektor') {
    // Poziom 1: menedżerowie bezpośrednio pod dyrektorem
    const { data: l1 } = await (admin() as any)
      .from('user_profiles')
      .select('id')
      .eq('manager_id', callerId);
    const menedzerIds = (l1 ?? []).map((u: any) => u.id);

    // Poziom 2: partnerzy pod tymi menedżerami
    let partnerIds: string[] = [];
    if (menedzerIds.length > 0) {
      const { data: l2 } = await (admin() as any)
        .from('user_profiles')
        .select('id')
        .in('manager_id', menedzerIds);
      partnerIds = (l2 ?? []).map((u: any) => u.id);
    }

    return [callerId, ...menedzerIds, ...partnerIds];
  }

  return [callerId];
}

/**
 * Dokłada filtr `.in('assigned_to', ids)` do zapytania Supabase.
 * ids = null → brak filtra (pełna widoczność).
 * ids puste → nic nie jest widoczne (zabezpieczenie przed wyciekiem całej tabeli).
 */
export function applyVisibilityFilter<T>(
  query: T,
  visibleIds: string[] | null,
  includeUnassigned = false,
): T {
  if (visibleIds === null) return query;

  if (visibleIds.length === 0) {
    return (query as any).eq('assigned_to', '00000000-0000-0000-0000-000000000000') as T;
  }

  if (includeUnassigned) {
    // menedżer/dyrektor widzi też leady jeszcze nieprzypisane
    const filter = visibleIds.map(id => `assigned_to.eq.${id}`).join(',');
    return (query as any).or(`assigned_to.is.null,${filter}`) as T;
  }

  return (query as any).in('assigned_to', visibleIds) as T;
}

/**
 * Leadowcy w mojej podstrukturze (ich manager_id wskazuje kogoś z mojego poddrzewa).
 * Pełna widoczność → wszyscy leadowcy.
 */
export async function getMyLeadowiecIds(
  callerId: string,
  callerRole: string,
): Promise<string[]> {
  const visibleIds = await getVisibleUserIds(callerId, callerRole);
  let q = (admin() as any).from('user_profiles').select('id').eq('role', 'leadowiec');
  if (visibleIds !== null) {
    q = q.in('manager_id', visibleIds);
  }
  const { data } = await q;
  return (data ?? []).map((u: any) => u.id);
}

export { admin };
