// POST /api/notes/from-text — zamienia notatkę/zapis rozmowy w ustalenia (E7e).
// Body: { text, title?, leadId?, origin? }
// Odpowiedź (kontrakt narzucony przez `components/agencja/HrTlumacz.tsx`, E2d):
//   { title, results: { events: [...], tasks: [...], emails: [...] } }
//
// Zapisuje notatkę w `crm_voice_notes`, a wyciągnięte terminy i zadania — w
// `calendar_events` i `app_tasks` (E7b). Szkice maili zostają przy notatce:
// poczta CRM to E6d (K4 w specu E7), więc nic stąd nie wychodzi na zewnątrz.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { admin } from '@/lib/crm/visibility';
import { wyciagnijUstalenia } from '@/lib/notes/extract';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Tłumacz agencji (E2d) też tu trafia — dlatego obok `crm.notatki` przechodzi
  // każdy, kto ma tłumacza; inaczej przycisk „Przetwórz rozmowę" byłby dla koordynatora martwy.
  const wolno = (await can(auth, 'crm.notatki')) || (await can(auth, 'agencja.tlumacz'));
  if (!wolno) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // AI-guard E2d: łagodna degradacja bez klucza — UI pokazuje komunikat, nic nie pada.
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ok: false,
      disabled: true,
      error: 'Asystent notatek wyłączony — brak ANTHROPIC_API_KEY',
    });
  }

  const body = await request.json().catch(() => ({}));
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  const leadId = typeof body?.leadId === 'string' ? body.leadId : null;
  const origin = ['text', 'glos', 'tlumacz'].includes(body?.origin) ? body.origin : 'text';

  if (!text) {
    return NextResponse.json({ error: 'Pusty tekst notatki' }, { status: 400 });
  }

  const title =
    (typeof body?.title === 'string' && body.title.trim()) ||
    `Notatka — ${new Date().toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;

  let analiza;
  try {
    analiza = await wyciagnijUstalenia(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Nieznany błąd';
    return NextResponse.json({ error: `Analiza notatki nie powiodła się: ${msg}` }, { status: 502 });
  }

  const sb = admin() as any;

  // Terminy → kalendarz. Każdy osobno: jeden zły wpis nie może przepaść z resztą.
  const utworzoneZdarzenia: { id: string; title: string; starts_at: string }[] = [];
  for (const e of analiza.events) {
    const { data, error } = await sb
      .from('calendar_events')
      .insert({
        title: e.title,
        description: e.description,
        starts_at: e.starts_at,
        ends_at: e.ends_at,
        all_day: e.all_day ?? false,
        location: e.location,
        source: 'ai',
        created_by: auth.id,
      })
      .select('id, title, starts_at')
      .single();
    if (!error && data) {
      utworzoneZdarzenia.push(data);
      // twórca jest uczestnikiem — inaczej wydarzenie nie pokaże mu się w kalendarzu
      await sb.from('calendar_attendees').insert({ event_id: data.id, user_id: auth.id });
    }
  }

  const utworzoneZadania: { id: string; title: string; due_date: string | null }[] = [];
  for (const t of analiza.tasks) {
    const { data, error } = await sb
      .from('app_tasks')
      .insert({
        title: t.title,
        description: t.description,
        assigned_to: auth.id,
        due_date: t.due_date,
        status: 'open',
        source: 'ai',
        created_by: auth.id,
      })
      .select('id, title, due_date')
      .single();
    if (!error && data) utworzoneZadania.push(data);
  }

  const { data: notatka, error: bladNotatki } = await sb
    .from('crm_voice_notes')
    .insert({
      created_by: auth.id,
      lead_id: leadId,
      title,
      source_text: text,
      summary: analiza.summary,
      email_drafts: analiza.emails,
      created_events: utworzoneZdarzenia,
      created_tasks: utworzoneZadania,
      origin,
    })
    .select('id, title, created_at')
    .single();

  if (bladNotatki) {
    return NextResponse.json({ error: bladNotatki.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: notatka.id,
    title: notatka.title,
    summary: analiza.summary,
    results: {
      events: utworzoneZdarzenia,
      tasks: utworzoneZadania,
      emails: analiza.emails,
    },
  }, { status: 201 });
}
