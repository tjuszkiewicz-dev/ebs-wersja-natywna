// Wspólny rdzeń Tłumacza Agencji Pracy — używany przez tryb tekstowy
// (/api/hr/translate) i rozmowę na żywo (/api/hr/translate/voice).
import { getAnthropic, AI_MODEL } from '@/lib/anthropic';

const anthropic = getAnthropic;

export const LANGS: Record<string, string> = {
  pl: 'polski', en: 'angielski', es: 'hiszpański', ru: 'rosyjski', uk: 'ukraiński', lt: 'litewski', de: 'niemiecki',
  fr: 'francuski', it: 'włoski', nl: 'niderlandzki (Holandia/Belgia)', cs: 'czeski', ro: 'rumuński', hu: 'węgierski',
  lv: 'łotewski', et: 'estoński', hi: 'hindi (hinduski)', vi: 'wietnamski', tl: 'filipiński (tagalog)',
  zh: 'chiński mandaryński', yue: 'chiński kantoński', ar: 'arabski', tr: 'turecki',
  no: 'norweski', fi: 'fiński', sv: 'szwedzki', af: 'afrikaans',
};

// nazwy języków zwracane przez Whisper (verbose_json.language) → kody
export const WHISPER_LANG: Record<string, string> = {
  polish: 'pl', english: 'en', spanish: 'es', russian: 'ru', ukrainian: 'uk', lithuanian: 'lt', german: 'de',
  french: 'fr', italian: 'it', dutch: 'nl', flemish: 'nl', czech: 'cs', romanian: 'ro', hungarian: 'hu',
  latvian: 'lv', estonian: 'et', hindi: 'hi', vietnamese: 'vi', tagalog: 'tl',
  chinese: 'zh', cantonese: 'yue', arabic: 'ar', turkish: 'tr',
  norwegian: 'no', nynorsk: 'no', finnish: 'fi', swedish: 'sv', afrikaans: 'af',
};

const SYSTEM = `Jesteś profesjonalnym tłumaczem agencji pracy zatrudniającej cudzoziemców (Polska).
Tłumaczysz komunikację między koordynatorami a pracownikami: wiadomości, instrukcje BHP, sprawy
zakwaterowania, dokumentów (paszport, PESEL, pozwolenie na pracę), rozliczeń i grafiku pracy.
Zasady: tłumacz WIERNIE i naturalnie (rejestr rozmówcy — zwykle uprzejmy, bezpośredni), zachowuj
formatowanie (akapity, listy), NIE tłumacz nazw własnych, numerów dokumentów, kwot ani dat.
Terminy urzędowe podawaj poprawnie w języku docelowym, a przy pierwszym użyciu zostaw polski
oryginał w nawiasie, np. "permiso de trabajo (zezwolenie na pracę)".
Format odpowiedzi (ściśle): PIERWSZA linia = wyłącznie kod ISO 639-1 języka źródłowego (np. ru).
Od DRUGIEJ linii = samo tłumaczenie, bez komentarzy, bez cudzysłowów wokół całości.`;

export async function translateWithClaude(text: string, target: string): Promise<{ detected: string; translation: string }> {
  const resp = await anthropic().messages.create({
    model: AI_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Język docelowy: ${LANGS[target]} (${target}).\n\nTekst:\n${text}` }],
  });
  const raw = resp.content.filter(c => c.type === 'text').map((c: any) => c.text).join('').trim();
  const nl = raw.indexOf('\n');
  const firstLine = (nl === -1 ? raw : raw.slice(0, nl)).trim().toLowerCase();
  const isCode = /^[a-z]{2}(-[a-z]{2})?$/.test(firstLine);
  return {
    detected: isCode ? firstLine.slice(0, 2) : '',
    translation: (isCode && nl !== -1 ? raw.slice(nl + 1) : raw).trim(),
  };
}
