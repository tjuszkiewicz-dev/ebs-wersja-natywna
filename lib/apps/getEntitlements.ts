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
