// POST /api/hr/candidates/import-drive — import CAŁEGO katalogu z Google Drive:
// {url, profession*, offset} → podfolder = jeden kandydat (pliki → teczka, OCR
// paszportu wypełnia kartę). Przetwarza JEDNĄ osobę na wywołanie (limit serverless)
// — UI pętli po offset aż done. Katalog musi mieć dostęp „każdy z linkiem" (pełny
// dostęp do odczytu).
//
// Kolejność jest CELOWA (poprawka po review — wcześniejsza wersja tworzyła szkielet
// karty PRZED decyzją o duplikacie/czarnej liście, co przy nieoczekiwanym wyjątku
// zostawiało sierotę z placeholderem i pustym numerem paszportu — dokładnie ten
// duplikat, przed którym to zadanie miało chronić): pliki pobieramy do PAMIĘCI, robimy
// OCR, i DOPIERO PO decyzji „to nie duplikat i nie czarna lista" zapisujemy cokolwiek
// do bazy/Storage. Dzięki temu przy każdym wcześniejszym wyjściu (duplikat, czarna
// lista, błąd pobierania) nie ma czego sprzątać — nic jeszcze nie powstało.
//
// AI-guard (E2d, obowiązkowy w całym repo): brak ANTHROPIC_API_KEY → import nadal
// działa (pliki się wgrywają, karta powstaje z nazwy folderu), tylko bez OCR —
// nigdy 500.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { extractDriveFolderId, listDriveFolder, downloadDriveFile, guessNameFromFolder, buildImportPatch } from '@/lib/hr/driveImport';
import { extractFromDocument, aggregateResults, resolveOcrType, sniffOcrType, normalizeDocNumber, type OcrResult } from '@/lib/hr/ocr';

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

  // Sprzątanie — wołane TYLKO gdy coś już powstało (patrz createdEmpId niżej). W normalnym
  // przebiegu (Option A) do tego nie dochodzi: decyzja zapada, ZANIM cokolwiek zapiszemy.
  // To siatka bezpieczeństwa na wypadek błędu MIĘDZY utworzeniem karty a zakończeniem
  // zapisu teczki (np. Storage padnie w połowie) — nie na duplikat/czarną listę.
  let createdEmpId: string | null = null;
  const uploadedPaths: string[] = [];
  const cleanupCreated = async () => {
    if (!createdEmpId) return;
    if (uploadedPaths.length) await sb.storage.from('hr-documents').remove(uploadedPaths).catch(() => {});
    await sb.from('hr_documents').delete().eq('employee_id', createdEmpId).catch(() => {});
    await sb.from('hr_employees').delete().eq('id', createdEmpId).catch(() => {});
  };

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

    // ── 1. pliki → PAMIĘĆ (jeszcze bez żadnego zapisu do bazy/Storage)
    const fetched: { driveId: string; name: string; buf: Buffer; contentType: string }[] = [];
    for (const f of files) {
      const dl = await downloadDriveFile(f.id);
      if (dl) fetched.push({ driveId: f.id, name: f.name, buf: dl.buf, contentType: dl.contentType });
    }
    if (!fetched.length) return NextResponse.json({ ...base, status: 'error', note: 'nie udało się pobrać żadnego pliku (dostęp? rozmiar?)' });

    // ── 2. OCR (jeśli klucz jest ustawiony): max 2 pliki, paszport-podobne najpierw.
    // Typ pliku ustalamy odpornie — nagłówek → nazwa → sygnatura bajtów — bo Google
    // Drive oddaje część plików jako application/octet-stream i takie paszporty
    // wcześniej NIGDY nie trafiały do OCR (brak numeru paszportu → deduplikacja nie
    // miała czego porównać → duplikaty osób).
    const aiDisabled = !process.env.ANTHROPIC_API_KEY;
    const ocrByDriveId = new Map<string, OcrResult>();
    let agg: OcrResult = {};
    if (!aiDisabled) {
      const ocrable = fetched
        .map(u => ({ ...u, ocrType: resolveOcrType(u.contentType, u.name) ?? sniffOcrType(u.buf) }))
        .filter((u): u is typeof u & { ocrType: string } => !!u.ocrType)
        .sort((a, z) => Number(/pas+z?port|pass/i.test(z.name)) - Number(/pas+z?port|pass/i.test(a.name)))
        .slice(0, 2);
      const results: OcrResult[] = [];
      for (const u of ocrable) {
        try {
          const res = await extractFromDocument(u.buf, u.ocrType);
          results.push(res);
          ocrByDriveId.set(u.driveId, res);
        } catch { /* pojedynczy plik może się nie odczytać — reszta importu jedzie dalej */ }
      }
      agg = aggregateResults(results);
    }

    // ── 3. decyzja PRZED jakimkolwiek zapisem: czarna lista i duplikat po numerze
    // paszportu (nr paszportu z OCR ma priorytet nad zgadniętym imieniem/nazwiskiem —
    // nazwa folderu bywa przekręcona/niepełna)
    const ocrPass = normNum(agg.passport_number);
    const fnGuess = (agg.first_name || guess.first || '').toLowerCase();
    const lnGuess = (agg.last_name || guess.last || '').toLowerCase();
    const { data: black } = await sb.from('hr_employees').select('first_name, last_name, passport_number, blacklist_reason').eq('blacklisted', true);
    const blackHit = (black || []).find((x: any) =>
      (ocrPass && normNum(x.passport_number) === ocrPass) ||
      ((x.first_name || '').trim().toLowerCase() === fnGuess && (x.last_name || '').trim().toLowerCase() === lnGuess));
    if (blackHit) return NextResponse.json({ ...base, status: 'blacklist', note: blackHit.blacklist_reason || 'czarna lista' });

    if (ocrPass) {
      const { data: everyone } = await sb.from('hr_employees').select('id, first_name, last_name, second_name, second_last_name, passport_number');
      const passportDup = (everyone || []).find((x: any) => x.passport_number && normNum(x.passport_number) === ocrPass);
      if (passportDup) {
        const dupName = [passportDup.first_name, passportDup.second_name, passportDup.last_name, passportDup.second_last_name].filter(Boolean).join(' ');
        return NextResponse.json({ ...base, status: 'skipped', note: `osoba już istnieje w systemie (nr paszportu)${dupName ? ` — ${dupName}` : ''}` });
      }
    }

    // ── 4. dopiero TERAZ zapis: karta od razu z docelowymi danymi (OCR albo, gdy OCR
    // nic nie zwrócił, nazwa folderu — buildImportPatch to czysta funkcja, patrz testy)
    const patch = buildImportPatch(agg, guess);
    const { data: emp, error: ee } = await sb.from('hr_employees').insert({
      ...patch,
      candidate: true, submitted_by: auth.id, submitted_at: new Date().toISOString(),
      coordinator_id: auth.role === 'koordynator' ? auth.id : null,
      profession, status: 'active', created_by: auth.id,
    }).select().single();
    if (ee || !emp) return NextResponse.json({ ...base, status: 'error', note: ee?.message || 'nie udało się utworzyć karty' });
    createdEmpId = emp.id;

    // ── 5. teczka: wgraj pliki pobrane w kroku 1, dopisz wynik OCR do dokumentu, z którego pochodzi
    const uploadedCount = { n: 0 };
    for (const f of fetched) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80) || 'plik';
      const path = `${emp.id}/drive-${f.driveId}-${safe}`;
      const up = await sb.storage.from('hr-documents').upload(path, f.buf, { contentType: f.contentType });
      if (up.error) continue;
      uploadedPaths.push(path);
      const ocr = ocrByDriveId.get(f.driveId);
      const { error: de } = await sb.from('hr_documents').insert({
        employee_id: emp.id, filename: f.name, path, content_type: f.contentType, size: f.buf.length, uploaded_by: auth.id,
        ...(ocr ? { ocr_status: 'done', ocr_data: ocr, ocr_at: new Date().toISOString() } : {}),
      });
      if (de) continue; // plik jest w Storage, ale wpis w hr_documents padł — nie liczymy go do teczki
      uploadedCount.n++;
    }
    if (!uploadedCount.n) {
      await cleanupCreated();
      return NextResponse.json({ ...base, status: 'error', note: 'nie udało się zapisać żadnego pliku w teczce' });
    }

    const empName = [emp.first_name, emp.second_name, emp.last_name, emp.second_last_name].filter(Boolean).join(' ');
    return NextResponse.json({
      ...base, status: 'created', name: empName, files: uploadedCount.n, fields: Object.keys(patch).length,
      ...(aiDisabled ? { disabled: true, note: 'OCR wyłączone — brak ANTHROPIC_API_KEY, dane tylko z nazwy folderu' } : {}),
    });
  } catch (e) {
    // Siatka bezpieczeństwa: jeśli karta zdążyła powstać (krok 4/5) zanim wyjątek
    // przerwał przetwarzanie, sprzątamy ją razem z tym, co zdążyło trafić do Storage —
    // żeby żaden nieoczekiwany błąd nie zostawił sieroty z placeholderem.
    await cleanupCreated();
    return NextResponse.json({ ...base, status: 'error', note: e instanceof Error ? e.message : 'nieoczekiwany błąd importu tej osoby' });
  }
}
