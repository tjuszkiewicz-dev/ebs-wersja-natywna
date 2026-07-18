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
