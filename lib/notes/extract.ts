// Wyciąganie ustaleń z tekstu notatki/rozmowy przez Claude (E7e).
//
// Zwraca strukturę, z której route buduje wpisy w `calendar_events` i `app_tasks`
// oraz szkice maili. Model DOSTAJE dzisiejszą datę, bo bez niej „w przyszły wtorek"
// nie da się rozwiązać — a rozmowy właśnie tak brzmią.
import { getAnthropic, AI_MODEL } from '@/lib/anthropic';

export interface WyciagnieteZdarzenie {
  title: string;
  starts_at: string;      // ISO 8601
  ends_at?: string | null;
  all_day?: boolean;
  location?: string | null;
  description?: string | null;
}

export interface WyciagnieteZadanie {
  title: string;
  description?: string | null;
  due_date?: string | null; // YYYY-MM-DD
}

export interface SzkicMaila {
  to?: string | null;
  subject: string;
  body: string;
}

export interface WynikAnalizy {
  summary: string;
  events: WyciagnieteZdarzenie[];
  tasks: WyciagnieteZadanie[];
  emails: SzkicMaila[];
}

const PUSTY: WynikAnalizy = { summary: '', events: [], tasks: [], emails: [] };

function bezpiecznaTablica<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

/** Odrzuca daty, których Postgres i tak by nie przyjął — model bywa twórczy. */
function poprawnaData(v: unknown): boolean {
  if (typeof v !== 'string' || !v.trim()) return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime());
}

export async function wyciagnijUstalenia(
  text: string,
  dzisiaj: Date = new Date(),
): Promise<WynikAnalizy> {
  const dataKontekst = dzisiaj.toISOString();
  const dzienTygodnia = dzisiaj.toLocaleDateString('pl-PL', { weekday: 'long' });

  const prompt = `Jesteś asystentem handlowca. Poniżej zapis notatki albo rozmowy z klientem.
Wyciągnij z niego USTALENIA. Nie zmyślaj — jeśli czegoś nie ma, zwróć pustą listę.

Dzisiaj jest ${dzienTygodnia}, ${dataKontekst} (strefa Europe/Warsaw).
Terminy względne ("jutro", "w przyszły wtorek", "za dwa tygodnie") rozwiąż względem tej daty.

Zwróć WYŁĄCZNIE JSON w tym kształcie, bez komentarza i bez bloku kodu:
{
  "summary": "2-4 zdania po polsku: o czym była rozmowa i co z niej wynika",
  "events": [{"title":"…","starts_at":"ISO 8601","ends_at":"ISO 8601 albo null","all_day":false,"location":"… albo null","description":"… albo null"}],
  "tasks": [{"title":"…","description":"… albo null","due_date":"YYYY-MM-DD albo null"}],
  "emails": [{"to":"adres albo null","subject":"…","body":"treść po polsku, gotowa do wysłania"}]
}

Zasady:
- "events" tylko dla ustalonych SPOTKAŃ i TERMINÓW z konkretną datą lub godziną.
- "tasks" dla rzeczy do zrobienia po naszej stronie.
- "emails" tylko wtedy, gdy z rozmowy wprost wynika, że trzeba coś wysłać.
- Wszystko po polsku.

ZAPIS:
"""
${text.slice(0, 40000)}
"""`;

  const resp = await getAnthropic().messages.create({
    model: AI_MODEL,
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  });

  // Ten sam wzorzec co `lib/hr/translateCore` i `lib/hr/ocr` — SDK typuje bloki
  // szerzej niż tekstowe, więc zawężamy przez `any` (konwencja repo).
  const surowy = resp.content
    .filter(c => c.type === 'text')
    .map((c: any) => c.text)
    .join('')
    .trim();

  // Model mimo instrukcji potrafi opakować JSON w ```json — bierzemy pierwszy obiekt.
  const start = surowy.indexOf('{');
  const end = surowy.lastIndexOf('}');
  if (start === -1 || end <= start) return { ...PUSTY };

  let dane: any;
  try {
    dane = JSON.parse(surowy.slice(start, end + 1));
  } catch {
    return { ...PUSTY };
  }

  return {
    summary: typeof dane.summary === 'string' ? dane.summary : '',
    events: bezpiecznaTablica<WyciagnieteZdarzenie>(dane.events)
      .filter(e => e && typeof e.title === 'string' && e.title.trim() && poprawnaData(e.starts_at))
      .map(e => ({
        title: e.title.trim().slice(0, 300),
        starts_at: new Date(e.starts_at).toISOString(),
        ends_at: poprawnaData(e.ends_at) ? new Date(e.ends_at as string).toISOString() : null,
        all_day: e.all_day === true,
        location: typeof e.location === 'string' ? e.location.slice(0, 300) : null,
        description: typeof e.description === 'string' ? e.description : null,
      })),
    tasks: bezpiecznaTablica<WyciagnieteZadanie>(dane.tasks)
      .filter(t => t && typeof t.title === 'string' && t.title.trim())
      .map(t => ({
        title: t.title.trim().slice(0, 300),
        description: typeof t.description === 'string' ? t.description : null,
        // `due_date` to kolumna DATE — bierzemy sam dzień, inaczej Postgres odrzuci wpis
        due_date:
          typeof t.due_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t.due_date)
            ? t.due_date.slice(0, 10)
            : null,
      })),
    emails: bezpiecznaTablica<SzkicMaila>(dane.emails)
      .filter(m => m && typeof m.subject === 'string' && typeof m.body === 'string')
      .map(m => ({
        to: typeof m.to === 'string' && m.to.includes('@') ? m.to : null,
        subject: m.subject.slice(0, 300),
        body: m.body,
      })),
  };
}
