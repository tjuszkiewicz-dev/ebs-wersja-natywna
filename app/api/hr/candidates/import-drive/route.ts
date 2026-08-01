// POST /api/hr/candidates/import-drive — import CAŁEGO katalogu z Google Drive:
// {url, profession*, offset} → podfolder = jeden kandydat (pliki → teczka, OCR
// paszportu wypełnia kartę). Przetwarza JEDNĄ osobę na wywołanie (limit serverless)
// — UI pętli po offset aż done. Katalog musi mieć dostęp „każdy z linkiem" (pełny
// dostęp do odczytu).
//
// AI-guard (E2d, obowiązkowy w całym repo): brak ANTHROPIC_API_KEY → import nadal
// działa (pliki się wgrywają, karta powstaje z nazwy folderu), tylko bez OCR —
// nigdy 500.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { extractDriveFolderId, listDriveFolder, downloadDriveFile, guessNameFromFolder } from '@/lib/hr/driveImport';
import { extractFromDocument, aggregateResults, mergeIntoEmployee, resolveOcrType, sniffOcrType, normalizeDocNumber, type OcrResult } from '@/lib/hr/ocr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FILES = 10;
const normNum = normalizeDocNumber;

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

  // Import przetwarza wiele osób w kolejnych wywołaniach (jedna osoba na request) —
  // błąd na TEJ osobie nie może zablokować pętli importu w UI, więc cała logika
  // poniżej jest w try/catch i zawsze zwraca 200 ze statusem 'error', nigdy 500.
  try {
    // dedup po nazwie (zgrubny — dopracowanie w kolejnym zadaniu): pomiń, jeśli osoba
    // o tych samych członach nazwiska już istnieje (aktywni, kandydaci, archiwum)
    const tokens = person.name.toLowerCase().replace(/[_.]+/g, ' ').split(/\s+/).filter(t => t.length > 2);
    const { data: existing } = await sb.from('hr_employees').select('first_name, last_name, second_name, second_last_name');
    const nameDup = (existing || []).find((x: any) => {
      const full = [x.first_name, x.second_name, x.last_name, x.second_last_name].filter(Boolean).join(' ').toLowerCase();
      const fn = (x.first_name || '').toLowerCase(), ln = (x.last_name || '').toLowerCase();
      return (fn && ln && tokens.includes(fn) && tokens.includes(ln)) || (full && tokens.length >= 2 && tokens.every(t => full.includes(t)));
    });
    if (nameDup) return NextResponse.json({ ...base, status: 'skipped', note: 'osoba już istnieje w systemie' });

    // lista plików osoby
    const files = person.isFolder ? (await listDriveFolder(person.id).catch(() => [])).filter(e => !e.isFolder).slice(0, MAX_FILES) : [person];
    if (!files.length) return NextResponse.json({ ...base, status: 'skipped', note: 'folder bez plików' });

    // kandydat-szkielet
    const { data: emp, error: ee } = await sb.from('hr_employees').insert({
      first_name: '—', last_name: `(import: ${person.name.slice(0, 40)})`,
      candidate: true, submitted_by: auth.id, submitted_at: new Date().toISOString(),
      coordinator_id: auth.role === 'koordynator' ? auth.id : null,
      profession, status: 'active', created_by: auth.id,
    }).select().single();
    if (ee || !emp) return NextResponse.json({ ...base, status: 'error', note: ee?.message || 'nie udało się utworzyć karty' });

    // Sprzątanie szkieletu — używane na KAŻDEJ ścieżce, na której odrzucamy import
    // (czarna lista, duplikat po paszporcie, brak plików): kasuje wgrane pliki ze
    // Storage, wpisy hr_documents i sam rekord hr_employees, żeby nie zostawiać sierot.
    const cleanup = async (paths: string[]) => {
      if (paths.length) await sb.storage.from('hr-documents').remove(paths).catch(() => {});
      await sb.from('hr_documents').delete().eq('employee_id', emp.id);
      await sb.from('hr_employees').delete().eq('id', emp.id);
    };

    // pobierz pliki → teczka
    const uploaded: { docId?: string; driveId: string; path: string; buf: Buffer; contentType: string; name: string }[] = [];
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
      uploaded.push({ docId: doc?.id, driveId: f.id, path, buf: dl.buf, contentType: dl.contentType, name: f.name });
    }
    if (!uploaded.length) { await cleanup(paths); return NextResponse.json({ ...base, status: 'error', note: 'nie udało się pobrać żadnego pliku (dostęp? rozmiar?)' }); }

    // AI-guard E2d: łagodna degradacja bez klucza — teczka zostaje, karta wypełniana
    // WYŁĄCZNIE z nazwy folderu (zero OCR, zero 500)
    if (!process.env.ANTHROPIC_API_KEY) {
      const patch: any = { first_name: guess.first, last_name: guess.last, updated_at: new Date().toISOString() };
      const { data: updated } = await sb.from('hr_employees').update(patch).eq('id', emp.id).select().single();
      const empName = [updated?.first_name, updated?.second_name, updated?.last_name, updated?.second_last_name].filter(Boolean).join(' ');
      return NextResponse.json({
        ...base, status: 'created', name: empName, files: uploaded.length, fields: 2,
        disabled: true, note: 'OCR wyłączone — brak ANTHROPIC_API_KEY, dane tylko z nazwy folderu',
      });
    }

    // ── OCR: max 2 pliki, paszport-podobne najpierw. Typ pliku ustalamy odpornie —
    // nagłówek → nazwa → sygnatura bajtów — bo Google Drive oddaje część plików jako
    // application/octet-stream i takie paszporty wcześniej NIGDY nie trafiały do OCR
    // (brak numeru paszportu → deduplikacja nie miała czego porównać → duplikaty osób).
    const ocrable = uploaded
      .map(u => ({ ...u, ocrType: resolveOcrType(u.contentType, u.name) ?? sniffOcrType(u.buf) }))
      .filter((u): u is typeof u & { ocrType: string } => !!u.ocrType)
      .sort((a, z) => Number(/pas+z?port|pass/i.test(z.name)) - Number(/pas+z?port|pass/i.test(a.name)))
      .slice(0, 2);

    const results: OcrResult[] = [];
    for (const u of ocrable) {
      try {
        const res = await extractFromDocument(u.buf, u.ocrType);
        results.push(res);
        if (u.docId) await sb.from('hr_documents').update({ ocr_status: 'done', ocr_data: res, ocr_at: new Date().toISOString() }).eq('id', u.docId);
      } catch { /* pojedynczy plik może się nie odczytać — reszta importu jedzie dalej */ }
    }
    const agg = aggregateResults(results);

    // czarna lista — po odczytanych danych (nr paszportu z OCR ma priorytet nad zgadniętym imieniem/nazwiskiem)
    const ocrPass = normNum(agg.passport_number);
    const fnGuess = (agg.first_name || guess.first || '').toLowerCase();
    const lnGuess = (agg.last_name || guess.last || '').toLowerCase();
    const { data: black } = await sb.from('hr_employees').select('first_name, last_name, passport_number, blacklist_reason').eq('blacklisted', true);
    const blackHit = (black || []).find((x: any) =>
      (ocrPass && normNum(x.passport_number) === ocrPass) ||
      ((x.first_name || '').trim().toLowerCase() === fnGuess && (x.last_name || '').trim().toLowerCase() === lnGuess));
    if (blackHit) {
      await cleanup(paths);
      return NextResponse.json({ ...base, status: 'blacklist', note: blackHit.blacklist_reason || 'czarna lista' });
    }

    // deduplikacja po numerze paszportu — twardy identyfikator (nazwa folderu bywa
    // przekręcona/niepełna); trafienie kasuje świeżo utworzony szkielet i kończy jako 'skipped'
    if (ocrPass) {
      const { data: everyone } = await sb.from('hr_employees').select('id, first_name, last_name, second_name, second_last_name, passport_number').neq('id', emp.id);
      const passportDup = (everyone || []).find((x: any) => x.passport_number && normNum(x.passport_number) === ocrPass);
      if (passportDup) {
        await cleanup(paths);
        const dupName = [passportDup.first_name, passportDup.second_name, passportDup.last_name, passportDup.second_last_name].filter(Boolean).join(' ');
        return NextResponse.json({ ...base, status: 'skipped', note: `osoba już istnieje w systemie (nr paszportu)${dupName ? ` — ${dupName}` : ''}` });
      }
    }

    // ── zapis danych: rekord startuje z PLACEHOLDERAMI ('—', '(import: …)') — to nie
    // są prawdziwe dane, więc dane z OCR ZAWSZE je nadpisują; nazwa folderu Drive jest
    // fallbackiem WYŁĄCZNIE gdy OCR nic nie odczytał (bez tego nazwiska w formacie
    // „NAZWISKA IMIONA" lądują w kolumnach imion).
    const { data: fresh } = await sb.from('hr_employees').select('*').eq('id', emp.id).single();
    const { applied } = mergeIntoEmployee(fresh, agg);
    const patch: any = { ...applied, updated_at: new Date().toISOString() };
    if (agg.first_name) { patch.first_name = agg.first_name; if (agg.second_name != null) patch.second_name = agg.second_name; }
    if (agg.last_name) { patch.last_name = agg.last_name; if (agg.second_last_name != null) patch.second_last_name = agg.second_last_name; }
    if (!patch.first_name) patch.first_name = guess.first;
    if (!patch.last_name) patch.last_name = guess.last;
    const { data: updated } = await sb.from('hr_employees').update(patch).eq('id', emp.id).select().single();

    const empName = [updated?.first_name, updated?.second_name, updated?.last_name, updated?.second_last_name].filter(Boolean).join(' ');
    return NextResponse.json({ ...base, status: 'created', name: empName, files: uploaded.length, fields: Object.keys(patch).length - 1 });
  } catch (e) {
    return NextResponse.json({ ...base, status: 'error', note: e instanceof Error ? e.message : 'nieoczekiwany błąd importu tej osoby' });
  }
}
