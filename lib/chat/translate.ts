// Tłumaczenie wiadomości komunikatora (spec E6 §4.6, D7/K14).
// Silnik: istniejący Tłumacz Agencji (`lib/hr/translateCore`, E2d) — bez nowego promptu.
// Pamięć podręczna: kolumny `translated_content` + `translated_lang` w chat_messages
// (schemat z bazy BBS). Jedno tłumaczenie na wiadomość; inny język docelowy nadpisuje.
//
// Dwa tryby:
//   * na żądanie (personel) — `translateMessage` z endpointu …/translate,
//   * automatycznie przy wysyłce w rozmowie 1:1 z pracownikiem tymczasowym — `autoTranslateOnSend`.
// Dzienny limit `consumeTranslator` obciąża TYLKO pracownika tymczasowego (jak w E2d).
// Awaria tłumacza nigdy nie blokuje zapisu wiadomości.
import { admin } from '@/lib/supabaseAdmin';
import { LANGS, WHISPER_LANG, translateWithClaude } from '@/lib/hr/translateCore';
import { consumeTranslator, TEXT_COST_S } from '@/lib/hr/translatorLimit';
import { isTempWorker } from '@/lib/chat/policy';

export const aiEnabled = (): boolean => !!process.env.ANTHROPIC_API_KEY;

/**
 * `hr_employees.language` to wolny tekst (ręcznie z kartoteki) albo kod z OCR.
 * Sprowadzamy do kodu z LANGS: „uk", „uk-UA", „ukraiński", „ukrainian" → „uk"; nieznane → null.
 */
export function normalizeLang(raw?: string | null): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  if (LANGS[s]) return s;
  const two = s.slice(0, 2);
  if (LANGS[two] && (s.length === 2 || s[2] === '-' || s[2] === '_')) return two;
  if (WHISPER_LANG[s]) return WHISPER_LANG[s];
  for (const [code, name] of Object.entries(LANGS)) {
    const base = name.toLowerCase().split(' ')[0];
    if (base === s || (s.length >= 4 && base.startsWith(s))) return code;
  }
  return null;
}

export interface TranslatableMessage {
  id: string; kind: string; content: string | null;
  translated_content?: string | null; translated_lang?: string | null; deleted_at?: string | null;
}

export type TranslateResult =
  | { ok: true; content: string; lang: string; cached: boolean; detected?: string }
  | { ok: false; disabled?: boolean; error: string };

/** Tłumaczy wiadomość tekstową na `target`, z pamięcią podręczną. `who` — kto prosi (limit dzienny). */
export async function translateMessage(msg: TranslatableMessage, target: string, who: { id: string; role: string }): Promise<TranslateResult> {
  if (!LANGS[target]) return { ok: false, error: 'Nieobsługiwany język docelowy' };
  if (msg.deleted_at || msg.kind !== 'text' || !msg.content?.trim()) return { ok: false, error: 'Tłumaczyć można tylko wiadomości tekstowe' };
  if (msg.translated_lang === target && msg.translated_content) return { ok: true, content: msg.translated_content, lang: target, cached: true };
  if (!aiEnabled()) return { ok: false, disabled: true, error: 'Tłumaczenie wyłączone — brak ANTHROPIC_API_KEY' };

  const limit = await consumeTranslator(who, TEXT_COST_S);
  if (!limit.ok) return { ok: false, error: 'Dzienny limit tłumacza wyczerpany — spróbuj jutro' };

  try {
    const { translation, detected } = await translateWithClaude(msg.content.slice(0, 8000), target);
    if (!translation) return { ok: false, error: 'Tłumacz zwrócił pustą odpowiedź' };
    await (admin() as any).from('chat_messages').update({ translated_content: translation, translated_lang: target }).eq('id', msg.id);
    return { ok: true, content: translation, lang: target, cached: false, detected };
  } catch (e) {
    console.error('[chat/translate]', e);
    return { ok: false, error: 'Błąd tłumaczenia — spróbuj ponownie' };
  }
}

/**
 * Automat przy wysyłce (K14): rozmowa 1:1, po drugiej stronie pracownik tymczasowy albo
 * nadawcą jest pracownik tymczasowy → tłumaczenie na język ODBIORCY.
 *   pracownik → koordynator: cel `pl`;
 *   koordynator → pracownik: cel z `hr_employees.language` (brak/nieznany/pl → bez tłumaczenia).
 * Best-effort: zwraca pola do dopisania w odpowiedzi albo null.
 */
export async function autoTranslateOnSend(
  msg: TranslatableMessage,
  sender: { id: string; role: string },
  others: { id: string; role: string }[],
): Promise<{ translated_content: string; translated_lang: string } | null> {
  if (others.length !== 1) return null;
  const other = others[0];
  let target: string | null = null;
  if (isTempWorker(sender.role)) {
    target = 'pl';
  } else if (isTempWorker(other.role)) {
    const { data: w } = await (admin() as any).from('hr_employees').select('language')
      .eq('user_id', other.id).eq('archived', false).maybeSingle();
    target = normalizeLang(w?.language);
    if (!target || target === 'pl') return null;
  } else {
    return null;
  }
  const r = await translateMessage(msg, target, sender);
  return r.ok ? { translated_content: r.content, translated_lang: r.lang } : null;
}
