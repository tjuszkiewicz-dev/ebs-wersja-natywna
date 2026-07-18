// POST /api/hr/ocr — odczyt AI dokumentów pracownika i uzupełnienie karty.
// Body: { employee_id, document_ids?: string[], use_cache?: boolean (default true) }
// Puste pola karty wypełniane automatycznie; różnice wracają jako konflikty do decyzji.
// Wynik odczytu per dokument trzymany w hr_documents.ocr_data (bez ponownych wywołań AI).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { extractFromDocument, aggregateResults, mergeIntoEmployee, resolveOcrType, sniffOcrType, isGenericType, type OcrResult } from '@/lib/hr/ocr';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_FRESH_PER_CALL = 4;           // świeże wywołania AI na request (limit czasu) — UI batchuje
const MAX_BYTES = 28 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // AI-guard E2d: łagodna degradacja bez klucza
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, disabled: true, error: 'Funkcja AI wyłączona — brak ANTHROPIC_API_KEY' });
  const b = await request.json().catch(() => null);
  if (!b?.employee_id) return NextResponse.json({ error: 'Brak pracownika' }, { status: 400 });
  const useCache = b.use_cache !== false;

  const sb = admin();
  const { data: employee, error: empErr } = await (sb as any).from('hr_employees').select('*').eq('id', b.employee_id).single();
  if (empErr || !employee) return NextResponse.json({ error: 'Nie ma takiego pracownika' }, { status: 404 });

  let q = (sb as any).from('hr_documents').select('*').eq('employee_id', b.employee_id);
  if (Array.isArray(b.document_ids) && b.document_ids.length) q = q.in('id', b.document_ids);
  const { data: docs, error: docErr } = await q;
  if (docErr) return NextResponse.json({ error: docErr.message }, { status: 500 });

  const results: OcrResult[] = [];
  const docStatus: any[] = [];
  let freshCalls = 0;
  let pending = 0;

  for (const doc of docs ?? []) {
    // PDF-y z naszego generatora (ścieżka gen-{uuid}) to wyniki, nie skany — nie czytamy ich AI
    if (/\/gen-/.test(doc.path || '')) {
      if (!doc.ocr_status) await (sb as any).from('hr_documents').update({ ocr_status: 'skipped', ocr_at: new Date().toISOString() }).eq('id', doc.id);
      continue;
    }
    // cache
    if (useCache && doc.ocr_status === 'done' && doc.ocr_data) {
      results.push(doc.ocr_data as OcrResult);
      docStatus.push({ id: doc.id, filename: doc.filename, status: 'cache', doc_type: (doc.ocr_data as any)?.doc_type ?? null });
      continue;
    }
    const rawCt = (doc.content_type || '').toLowerCase();
    let ct = resolveOcrType(rawCt, doc.filename);
    // realny, ale nieobsługiwany typ (np. HEIC) — bez sensu pobierać
    if (!ct && !isGenericType(rawCt)) {
      const note = /heic|heif/.test(rawCt) ? 'format HEIC — zapisz jako JPG i wgraj ponownie' : `nieobsługiwany format (${rawCt})`;
      await (sb as any).from('hr_documents').update({ ocr_status: 'skipped', ocr_at: new Date().toISOString() }).eq('id', doc.id);
      docStatus.push({ id: doc.id, filename: doc.filename, status: 'skipped', note });
      continue;
    }
    if (freshCalls >= MAX_FRESH_PER_CALL) { pending++; continue; }
    freshCalls++;
    try {
      const { data: file, error: dlErr } = await sb.storage.from('hr-documents').download(doc.path);
      if (dlErr || !file) throw new Error(dlErr?.message || 'pobranie nieudane');
      const buf = Buffer.from(await file.arrayBuffer());
      if (buf.length > MAX_BYTES) throw new Error('plik za duży dla odczytu');
      // octet-stream bez rozszerzenia — typ z sygnatury pliku
      if (!ct) ct = sniffOcrType(buf);
      if (!ct) {
        await (sb as any).from('hr_documents').update({ ocr_status: 'skipped', ocr_at: new Date().toISOString() }).eq('id', doc.id);
        docStatus.push({ id: doc.id, filename: doc.filename, status: 'skipped', note: 'nierozpoznany format pliku' });
        continue;
      }
      const extracted = await extractFromDocument(buf, ct);
      await (sb as any).from('hr_documents').update({ ocr_status: 'done', ocr_data: extracted, ocr_at: new Date().toISOString() }).eq('id', doc.id);
      results.push(extracted);
      docStatus.push({ id: doc.id, filename: doc.filename, status: 'done', doc_type: extracted.doc_type ?? null });
    } catch (e: any) {
      await (sb as any).from('hr_documents').update({ ocr_status: 'error', ocr_at: new Date().toISOString() }).eq('id', doc.id);
      docStatus.push({ id: doc.id, filename: doc.filename, status: 'error', note: e?.message || 'błąd odczytu' });
    }
  }

  const agg = aggregateResults(results);
  const { applied, conflicts } = mergeIntoEmployee(employee, agg);

  if (Object.keys(applied).length) {
    const { error: updErr } = await (sb as any).from('hr_employees')
      .update({ ...applied, updated_at: new Date().toISOString() })
      .eq('id', b.employee_id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ applied, conflicts, docs: docStatus, pending });
}
