// Mapa id → profil, do rozwijania identyfikatorów na nazwiska w kalendarzu i zadaniach (E7b).
// W BBS ten helper mieszkał w `lib/chat/server` (moduł komunikatora). EBS nie ma jeszcze czatu
// (E6a), więc zamiast ciągnąć całą zależność portujemy samą funkcję — jest kilkulinijkowa.
import { admin } from '@/lib/supabaseAdmin';

export interface ProfileLite { id: string; full_name: string | null; role: string | null }

export async function profilesMap(ids: (string | null | undefined)[]): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (unique.length === 0) return new Map();

  const { data } = await (admin() as any)
    .from('user_profiles')
    .select('id, full_name, role')
    .in('id', unique);

  return new Map((data ?? []).map((p: ProfileLite) => [p.id, p]));
}
