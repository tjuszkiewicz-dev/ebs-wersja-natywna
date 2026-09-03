// Formatowanie w komunikatorze — w BBS te helpery były powielone w trzech miejscach
// ChatApp.tsx (nagłówek listy, wiersz rozmowy, katalog). Czyste funkcje, bez React.

export type MessageKind = 'text' | 'audio' | 'file' | 'image' | 'system' | 'recording';

/** Skrót treści do listy rozmów i dymka cytatu. */
export function previewOf(m: { kind?: string | null; content?: string | null; file_name?: string | null; deleted_at?: string | null; deleted?: boolean } | null | undefined, max = 80): string | null {
  if (!m) return null;
  if (m.deleted_at || m.deleted) return 'wiadomość usunięta';
  switch (m.kind) {
    case 'text': return String(m.content || '').slice(0, max);
    case 'audio': return '🎤 Głosówka';
    case 'image': return '📷 Zdjęcie';
    case 'recording': return '⏺️ Nagranie spotkania';
    case 'system': return String(m.content || '').slice(0, max);
    default: return `📎 ${m.file_name || 'Plik'}`;
  }
}

export const tTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

/** „Dzisiaj" / „Wczoraj" / data — separator dni w wątku. `now` do testów. */
export function tDay(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return 'Dzisiaj';
  if (d.toDateString() === y.toDateString()) return 'Wczoraj';
  return d.toLocaleDateString('pl-PL');
}

/** Sekundy → m:ss (głosówki, nagrania). */
export function fmtDur(s?: number | null): string {
  const n = Math.round(Number(s) || 0);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
}

/** Inicjały do awatara (maks. 2 litery). */
export const initials = (n: string): string =>
  n.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

/** Deterministyczny odcień z nazwy — ten sam kolor awatara u każdego. */
export function hue(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

/** Etykiety ról w katalogu (wartości z app_roles EBS + role bez wpisu w app_roles). */
export const ROLE_PL: Record<string, string> = {
  owner: 'Właściciel', superadmin: 'Administrator', dyrektor: 'Dyrektor', menedzer: 'Menedżer',
  partner: 'Doradca', leadowiec: 'Leadowiec', hr: 'Panel HR', koordynator: 'Koordynator',
  szef_koordynatorow: 'Szef koordynatorów', platnik: 'Płatnik', pracownik_tymczasowy: 'Pracownik tymczasowy',
  pracodawca: 'Pracodawca', pracownik: 'Pracownik',
};
export const roleLabel = (role?: string | null): string => (role && ROLE_PL[role]) || role || '';
