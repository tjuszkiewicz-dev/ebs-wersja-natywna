// POST /api/hr/candidates/from-passport — zgłoszenie kandydata ZE ZDJĘCIA PASZPORTU:
// multipart {file, profession*, language?} → tworzy kandydata w Poczekalni,
// wgrywa skan do teczki, czyta AI (OCR) i wypełnia kartę (imiona/nazwiska/paszport…).
// Walidacja czarnej listy PO odczycie (paszport lub imię+nazwisko) — trafienie
// usuwa utworzony rekord i zwraca 409.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { extractFromDocument, mergeIntoEmployee, aggregateResults, resolveOcrType, sniffOcrType } from '@/lib/hr/ocr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // AI-guard E2d: łagodna degradacja bez klucza (cała ścieżka zależy od odczytu OCR)
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: true, ocr: null, disabled: true });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  const profession = String(form?.get('profession') || '').trim();
  const language = String(form?.get('language') || '').trim() || null;
  if (!file || typeof file === 'string') return NextResponse.json({ error: 'Dodaj zdjęcie paszportu' }, { status: 400 });
  if (!profession) return NextResponse.json({ error: 'Zawód / specjalizacja jest wymagana' }, { status: 400 });
  // Skanery/przeglądarki wysyłają PDF-y i zdjęcia bywa że jako octet-stream —
  // typ ustalamy z nagłówka, potem z rozszerzenia nazwy, w ostateczności z sygnatury bajtów.
  const rawBuf = Buffer.from(await file.arrayBuffer());
  const contentType = resolveOcrType(file.type, file.name) || sniffOcrType(rawBuf);
  if (!contentType) {
    return NextResponse.json({ error: 'Obsługiwane formaty: JPG, PNG, WEBP, GIF, PDF (HEIC zapisz jako JPG)' }, { status: 400 });
  }

  const sb = admin() as any;
  // 1) tymczasowy kandydat (nazwiska uzupełni OCR)
  const { data: emp, error: ee } = await sb.from('hr_employees').insert({
    first_name: '—', last_name: '(odczyt paszportu…)',
    candidate: true, submitted_by: auth.id, submitted_at: new Date().toISOString(),
    coordinator_id: auth.role === 'koordynator' ? auth.id : null,
    profession, language, status: 'active', created_by: auth.id,
  }).select().single();
  if (ee) return NextResponse.json({ error: ee.message }, { status: 500 });

  const cleanup = async (path?: string) => {
    if (path) await sb.storage.from('hr-documents').remove([path]).catch(() => {});
    await sb.from('hr_documents').delete().eq('employee_id', emp.id);
    await sb.from('hr_employees').delete().eq('id', emp.id);
  };

  // 2) skan do teczki
  const buf = rawBuf;
  const safe = (file.name || 'paszport').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
  const path = `${emp.id}/${Date.now()}-${safe}`;
  const up = await sb.storage.from('hr-documents').upload(path, buf, { contentType });
  if (up.error) { await cleanup(); return NextResponse.json({ error: `Upload: ${up.error.message}` }, { status: 500 }); }
  const { data: doc } = await sb.from('hr_documents').insert({
    employee_id: emp.id, filename: file.name || safe, path, content_type: contentType, size: file.size || null, uploaded_by: auth.id,
  }).select().single();

  // 3) OCR paszportu (AI) → wypełnienie karty
  let applied: Record<string, string> = {};
  try {
    const result = await extractFromDocument(buf, contentType);
    if (doc?.id) await sb.from('hr_documents').update({ ocr_status: 'done', ocr_data: result, ocr_at: new Date().toISOString() }).eq('id', doc.id);
    const agg = aggregateResults([result]);
    const merged = mergeIntoEmployee(emp, agg);
    applied = merged.applied;
  } catch (e) {
    // OCR padł — kandydat zostaje z placeholderem, użytkownik uzupełni ręcznie
    return NextResponse.json({ employee: emp, applied: {}, warning: 'Nie udało się odczytać paszportu — uzupełnij dane ręcznie w karcie.' }, { status: 201 });
  }

  // 4) walidacja czarnej listy na ODCZYTANYCH danych
  const fn = (applied.first_name || '').toLowerCase();
  const ln = (applied.last_name || '').toLowerCase();
  const pass = (applied.passport_number || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (fn || ln || pass) {
    const { data: black } = await sb.from('hr_employees').select('first_name, last_name, passport_number, blacklist_reason').eq('blacklisted', true);
    const hit = (black || []).find((x: any) =>
      (pass && (x.passport_number || '').replace(/[^a-z0-9]/gi, '').toLowerCase() === pass) ||
      (fn && ln && (x.first_name || '').trim().toLowerCase() === fn && (x.last_name || '').trim().toLowerCase() === ln));
    if (hit) {
      await cleanup(path);
      return NextResponse.json({ error: `Ta osoba jest na CZARNEJ LIŚCIE${hit.blacklist_reason ? ` — powód: ${hit.blacklist_reason}` : ''}. Zgłoszenie odrzucone.` }, { status: 409 });
    }
  }

  // 4b) DUPLIKAT po nr. paszportu — nie dublujemy osoby (pomijamy właśnie utworzony rekord tymczasowy)
  if (pass) {
    const { data: dupRows } = await sb.from('hr_employees')
      .select('*, contract:hr_contracts(id, name), accommodation:hr_accommodations(id, name, address)')
      .eq('archived', false).neq('id', emp.id);
    const dup = (dupRows || []).find((x: any) => (x.passport_number || '').replace(/[^a-z0-9]/gi, '').toLowerCase() === pass);
    if (dup) {
      await cleanup(path);
      const dupName = [dup.first_name, dup.second_name, dup.last_name, dup.second_last_name].filter(Boolean).join(' ');
      return NextResponse.json({
        error: `Pracownik o tym numerze paszportu już istnieje: ${dupName}${dup.contract?.name ? ` — kontrakt „${dup.contract.name}"` : dup.candidate ? ' — Poczekalnia' : ''}.`,
        duplicate: true, existing: dup,
      }, { status: 409 });
    }
  }

  // 5) zapis odczytanych pól (placeholdery nazwisk nadpisujemy zawsze)
  const patch: any = { ...applied, updated_at: new Date().toISOString() };
  if (!patch.first_name) patch.first_name = '—';
  if (!patch.last_name) patch.last_name = '(uzupełnij nazwisko)';
  const { data: updated } = await sb.from('hr_employees').update(patch).eq('id', emp.id).select().single();

  return NextResponse.json({ employee: updated ?? emp, applied }, { status: 201 });
}
