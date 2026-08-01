// Widoczność koordynatora: kontrakty jawnie przyznane w Ustawieniach
// (dodatkowo do kontraktów, na których koordynator ma swoich pracowników).
// szef_koordynatorow i administracja widzą wszystko (nie wchodzą w te filtry).
import { admin } from '@/lib/supabaseAdmin';

export async function coordinatorGrantedContractIds(userId: string): Promise<string[]> {
  // hr_coordinator_contracts nie jest jeszcze w types/database.ts (konwencja repo dla tabel
  // spoza wygenerowanego schematu — patrz document_templates w CLAUDE.md)
  const { data } = await (admin() as any).from('hr_coordinator_contracts').select('contract_id').eq('coordinator_id', userId);
  return [...new Set((data || []).map((r: any) => r.contract_id).filter(Boolean))] as string[];
}

// Pełny zakres kontraktów koordynatora widoczny w UI (np. dropdown w Archiwum,
// GET /api/hr/contracts): kontrakty, na których ma choć jednego aktywnego pracownika,
// suma z kontraktami jawnie przyznanymi w Ustawieniach. JEDYNE źródło prawdy dla tej
// definicji — używane zarówno do budowania list wybieralnych, jak i do strażników
// uprawnień (np. wybór kontraktu przy przywracaniu z Archiwum), żeby obie strony
// nigdy się nie rozjechały.
export async function coordinatorContractScope(userId: string): Promise<string[]> {
  const sb = admin() as any;
  const [{ data: mine }, granted] = await Promise.all([
    sb.from('hr_employees').select('contract_id').eq('coordinator_id', userId).eq('archived', false).not('contract_id', 'is', null),
    coordinatorGrantedContractIds(userId),
  ]);
  return [...new Set([...(mine || []).map((r: any) => r.contract_id).filter(Boolean), ...granted])] as string[];
}
