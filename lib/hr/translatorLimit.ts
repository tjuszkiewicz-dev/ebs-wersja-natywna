// Dzienny limit PŁATNEGO tłumacza dla pracowników tymczasowych (koszty API!).
// Liczymy sekundy: rozmowa głosowa 1:1 (heartbeat/wypowiedź), tłumaczenie tekstu = 15 s.
// Role agencji (koordynator, szef, admin…) — bez limitu.
import { admin } from '@/lib/supabaseAdmin';

export const DAILY_LIMIT_S = 600;      // 10 minut dziennie
export const TEXT_COST_S = 15;         // umowny koszt jednego tłumaczenia tekstu
export const VOICE_UTTER_COST_S = 15;  // wypowiedź w trybie zapasowym (Whisper)

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(s);

export interface LimitState { limited: boolean; ok: boolean; used: number; remaining: number }

// sprawdź i zużyj `seconds` z dziennego limitu; seconds=0 → tylko odczyt stanu
export async function consumeTranslator(auth: { id: string; role?: string | null }, seconds: number): Promise<LimitState> {
  if (auth.role !== 'pracownik_tymczasowy') return { limited: false, ok: true, used: 0, remaining: DAILY_LIMIT_S };
  if (!isUuid(String(auth.id))) return { limited: true, ok: true, used: 0, remaining: DAILY_LIMIT_S }; // konto testowe
  const sb = admin() as any;
  const day = new Date().toISOString().slice(0, 10);
  const { data: row } = await sb.from('hr_translator_usage').select('seconds').eq('user_id', auth.id).eq('day', day).maybeSingle();
  const used = Number(row?.seconds || 0);
  if (used >= DAILY_LIMIT_S) return { limited: true, ok: false, used, remaining: 0 };
  if (seconds > 0) {
    const next = Math.min(DAILY_LIMIT_S, used + seconds);
    await sb.from('hr_translator_usage').upsert({ user_id: auth.id, day, seconds: next }, { onConflict: 'user_id,day' });
    return { limited: true, ok: true, used: next, remaining: Math.max(0, DAILY_LIMIT_S - next) };
  }
  return { limited: true, ok: true, used, remaining: DAILY_LIMIT_S - used };
}
