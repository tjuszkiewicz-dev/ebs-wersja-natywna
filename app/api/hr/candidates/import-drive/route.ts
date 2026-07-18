// POST /api/hr/candidates/import-drive — import CAŁEGO katalogu z Google Drive:
// {url, profession*, offset} → podfolder = jeden kandydat (pliki → teczka).
// Przetwarza JEDNĄ osobę na wywołanie (limit serverless) — UI pętli po offset aż done.
// Katalog musi mieć dostęp „każdy z linkiem" (pełny dostęp do odczytu).
// OCR-enrichment: E2d (wycięte z portu E2b — plain Drive import działa, karta wypełniana ręcznie)
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { extractDriveFolderId, listDriveFolder, downloadDriveFile, guessNameFromFolder } from '@/lib/hr/driveImport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILES = 10;

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => null);
  const url = String(b?.url || '').trim();
  const profession = String(b?.profession || '').trim();
  const offset = Math.max(0, Number(b?.offset) || 0);
  if (!url) return NextResponse.json({ error: 'Wklej link do katalogu Google Drive' }, { status: 400 });
  if (!profession) return NextResponse.json({ error: 'Wybierz zawód / specjalizację dla importowanych kandydatów' }, { status: 400 });

  const folderId = extractDriveFolderId(url);
  if (!folderId) return NextResponse.json({ error: 'Nie rozpoznaję linku — wklej adres KATALOGU Google Drive (…/drive/folders/…)' }, { status: 400 });

  let entries;
  try { entries = await listDriveFolder(folderId); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Nie udało się odczytać katalogu' }, { status: 502 }); }

  // podfoldery = osoby; katalog płaski = każdy plik to jedna osoba (np. same skany paszportów)
  const folders = entries.filter(e => e.isFolder);
  const persons = folders.length ? folders : entries.filter(e => !e.isFolder);
  if (!persons.length) return NextResponse.json({ error: 'Katalog jest pusty albo brak dostępu — ustaw w Google Drive „każdy z linkiem może wyświetlać"' }, { status: 400 });
  if (offset >= persons.length) return NextResponse.json({ done: true, total: persons.length });

  const person = persons[offset];
  const sb = admin() as any;
  const guess = guessNameFromFolder(person.name);
  const base = { done: offset + 1 >= persons.length, total: persons.length, index: offset, name: person.name };

  // dedup: pomiń, jeśli osoba o tych samych członach nazwiska już istnieje (aktywni, kandydaci, archiwum)
  const tokens = person.name.toLowerCase().replace(/[_.]+/g, ' ').split(/\s+/).filter(t => t.length > 2);
  const { data: existing } = await sb.from('hr_employees').select('first_name, last_name, second_name, second_last_name');
  const dup = (existing || []).find((x: any) => {
    const full = [x.first_name, x.second_name, x.last_name, x.second_last_name].filter(Boolean).join(' ').toLowerCase();
    const fn = (x.first_name || '').toLowerCase(), ln = (x.last_name || '').toLowerCase();
    return (fn && ln && tokens.includes(fn) && tokens.includes(ln)) || (full && tokens.length >= 2 && tokens.every(t => full.includes(t)));
  });
  if (dup) return NextResponse.json({ ...base, status: 'skipped', note: 'osoba już istnieje w systemie' });

  // lista plików osoby
  let files = person.isFolder ? (await listDriveFolder(person.id).catch(() => [])).filter(e => !e.isFolder).slice(0, MAX_FILES) : [person];
  if (!files.length) return NextResponse.json({ ...base, status: 'skipped', note: 'folder bez plików' });

  // kandydat-szkielet
  const { data: emp, error: ee } = await sb.from('hr_employees').insert({
    first_name: '—', last_name: `(import: ${person.name.slice(0, 40)})`,
    candidate: true, submitted_by: auth.id, submitted_at: new Date().toISOString(),
    coordinator_id: auth.role === 'koordynator' ? auth.id : null,
    profession, status: 'active', created_by: auth.id,
  }).select().single();
  if (ee) return NextResponse.json({ ...base, status: 'error', note: ee.message });

  const cleanup = async (paths: string[]) => {
    if (paths.length) await sb.storage.from('hr-documents').remove(paths).catch(() => {});
    await sb.from('hr_documents').delete().eq('employee_id', emp.id);
    await sb.from('hr_employees').delete().eq('id', emp.id);
  };

  // pobierz pliki → teczka
  const uploaded: { docId: string; path: string; buf: Buffer; contentType: string; name: string }[] = [];
  const paths: string[] = [];
  for (const f of files) {
    const dl = await downloadDriveFile(f.id);
    if (!dl) continue;
    const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'plik';
    const path = `${emp.id}/drive-${f.id}-${safe}`;
    const up = await sb.storage.from('hr-documents').upload(path, dl.buf, { contentType: dl.contentType });
    if (up.error) continue;
    paths.push(path);
    const { data: doc } = await sb.from('hr_documents').insert({
      employee_id: emp.id, filename: f.name, path, content_type: dl.contentType, size: dl.buf.length, uploaded_by: auth.id,
    }).select('id').single();
    uploaded.push({ docId: doc?.id, path, buf: dl.buf, contentType: dl.contentType, name: f.name });
  }
  if (!uploaded.length) { await cleanup(paths); return NextResponse.json({ ...base, status: 'error', note: 'nie udało się pobrać żadnego pliku (dostęp? rozmiar?)' }); }

  // czarna lista na danych z nazwy folderu (bez OCR — dane paszportowe uzupełnia się ręcznie, E2d)
  const fn = guess.first.toLowerCase();
  const ln = guess.last.toLowerCase();
  const { data: black } = await sb.from('hr_employees').select('first_name, last_name, passport_number, blacklist_reason').eq('blacklisted', true);
  const hit = (black || []).find((x: any) =>
    (x.first_name || '').trim().toLowerCase() === fn && (x.last_name || '').trim().toLowerCase() === ln);
  if (hit) {
    await cleanup(paths);
    return NextResponse.json({ ...base, status: 'blacklist', note: hit.blacklist_reason || 'czarna lista' });
  }

  // zapis danych (nazwisko z nazwy folderu — bez OCR paszportu, patrz E2d)
  const patch: any = { first_name: guess.first, last_name: guess.last, updated_at: new Date().toISOString() };
  const { data: updated } = await sb.from('hr_employees').update(patch).eq('id', emp.id).select().single();

  const empName = [updated?.first_name, updated?.second_name, updated?.last_name, updated?.second_last_name].filter(Boolean).join(' ');
  return NextResponse.json({ ...base, status: 'created', name: empName, files: uploaded.length, fields: Object.keys(patch).length });
}
