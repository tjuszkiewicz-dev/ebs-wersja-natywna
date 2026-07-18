'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, FileText, Trash2, ExternalLink, Loader2, ScanText, CheckCircle2, AlertTriangle, X, CopyCheck } from 'lucide-react';
import { Hint } from '@/components/ui/Hint';

interface Doc { id: string; filename: string; content_type?: string | null; size?: number | null; created_at: string; url: string | null; }
interface OcrConflict { field: string; current: string; extracted: string }
interface OcrOutcome { applied: Record<string, string>; conflicts: OcrConflict[]; docs: { id: string; filename: string; status: string; note?: string }[] }

const fmtSize = (b?: number | null) => (!b ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const isImg = (ct?: string | null) => (ct || '').startsWith('image/');

const FIELD_LABELS: Record<string, string> = {
  first_name: 'Imię', second_name: 'Drugie imię', last_name: 'Nazwisko', second_last_name: 'Drugie nazwisko', family_name: 'Nazwisko rodowe',
  language: 'Język dokumentów',
  passport_number: 'Nr paszportu', passport_expiry: 'Paszport ważny do',
  birth_date: 'Data urodzenia', birth_place: 'Miejsce urodzenia', country_of_origin: 'Kraj pochodzenia',
  pesel: 'PESEL', bank_account: 'Nr konta bankowego',
  residence_card_number: 'Nr karty pobytu', residence_card_expiry: 'Karta pobytu ważna do',
  work_permit_number: 'Nr pozwolenia na pracę', work_permit_expiry: 'Pozwolenie ważne do', visa_expiry: 'Wiza ważna do',
};
const fLabel = (f: string) => FIELD_LABELS[f] ?? f;

export function HrEmployeeDocs({ employeeId }: { employeeId: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [canDelete, setCanDelete] = useState(true); // koordynator: tylko dodawanie
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrNote, setOcrNote] = useState('');
  const [ocr, setOcr] = useState<OcrOutcome | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set()); // konflikty wybrane do nadpisania
  const [applyingConflicts, setApplyingConflicts] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/hr/employees/${employeeId}/documents`, { credentials: 'same-origin' });
      const d = await r.json();
      setDocs(d.documents || []);
      if (d.can_delete !== undefined) setCanDelete(!!d.can_delete);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [employeeId]);
  useEffect(() => { load(); setOcr(null); setChosen(new Set()); }, [load]);

  const runOcr = useCallback(async () => {
    setOcrRunning(true); setOcrNote('Czytanie dokumentów przez AI…'); setError(null);
    try {
      // API czyta max 4 świeże dokumenty na wywołanie — pętla aż przeczyta wszystkie
      let res: OcrOutcome & { pending?: number };
      let guard = 0;
      do {
        const r = await fetch('/api/hr/ocr', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ employee_id: employeeId }),
        });
        res = await r.json();
        if (!r.ok) throw new Error((res as any).error || 'Błąd odczytu');
        if ((res as any).ok === false || (res as any).disabled) {
          setError((res as any).error || 'Funkcja OCR wyłączona — skonfiguruj ANTHROPIC_API_KEY');
          return;
        }
        if (res.pending) setOcrNote(`Czytanie dokumentów… (pozostało ${res.pending})`);
      } while (res.pending && ++guard < 10);
      setOcr(res); setChosen(new Set());
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd odczytu'); }
    finally { setOcrRunning(false); setOcrNote(''); }
  }, [employeeId]);

  const uploadFiles = async (files: FileList | File[]) => {
    setUploading(true); setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData(); fd.append('file', file);
        const r = await fetch(`/api/hr/employees/${employeeId}/documents`, { method: 'POST', body: fd, credentials: 'same-origin' });
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Błąd wysyłania'); }
      }
      await load();
      // auto-OCR po wgraniu (nowe pliki czytane od razu, stare z pamięci)
      runOcr();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd wysyłania'); }
    finally { setUploading(false); }
  };

  const del = async (docId: string) => {
    if (!confirm('Usunąć dokument?')) return;
    await fetch(`/api/hr/employees/${employeeId}/documents/${docId}`, { method: 'DELETE', credentials: 'same-origin' });
    await load();
  };

  // ── Zaznaczanie wielu dokumentów + zbiorcze usuwanie ──
  const [selectMode, setSelectMode] = useState(false);
  const [selDocs, setSelDocs] = useState<Set<string>>(new Set());
  const [deletingMany, setDeletingMany] = useState(false);

  const toggleDoc = (id: string) => setSelDocs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const exitSelect = () => { setSelectMode(false); setSelDocs(new Set()); };

  const delSelected = async () => {
    if (!selDocs.size) return;
    if (!confirm(`Usunąć ${selDocs.size} zaznaczonych dokumentów? Tej operacji nie można cofnąć.`)) return;
    setDeletingMany(true); setError(null);
    try {
      for (const id of selDocs) {
        const r = await fetch(`/api/hr/employees/${employeeId}/documents/${id}`, { method: 'DELETE', credentials: 'same-origin' });
        if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Błąd usuwania'); }
      }
      exitSelect();
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd usuwania'); await load(); }
    finally { setDeletingMany(false); }
  };

  const applyConflicts = async () => {
    if (!ocr || !chosen.size) return;
    setApplyingConflicts(true);
    try {
      const patch: Record<string, string> = {};
      for (const c of ocr.conflicts) if (chosen.has(c.field)) patch[c.field] = c.extracted;
      const r = await fetch(`/api/hr/employees/${employeeId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(patch),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || 'Błąd zapisu'); }
      setOcr({ ...ocr, applied: { ...ocr.applied, ...patch }, conflicts: ocr.conflicts.filter(c => !chosen.has(c.field)) });
      setChosen(new Set());
    } catch (e) { setError(e instanceof Error ? e.message : 'Błąd'); }
    finally { setApplyingConflicts(false); }
  };

  const appliedEntries = ocr ? Object.entries(ocr.applied) : [];
  const problemDocs = ocr ? ocr.docs.filter(d => d.status === 'skipped' || d.status === 'error') : [];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Wgrane dokumenty czytane są automatycznie (AI) i uzupełniają kartę pracownika.</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {!selectMode ? (
            <>
              {canDelete && <button onClick={() => setSelectMode(true)} disabled={loading || docs.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                <CopyCheck size={13} /> Zaznacz wiele
              </button>}
              {canDelete && <Hint text="Tryb zaznaczania: klikasz kafelki dokumentów, potem możesz usunąć wiele naraz. Koordynator nie widzi tej opcji (tylko dodaje pliki)." className="self-center" />}
              <button onClick={runOcr} disabled={ocrRunning || loading || docs.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-50">
                {ocrRunning ? <Loader2 size={13} className="animate-spin" /> : <ScanText size={13} />} Odczytaj dane (OCR)
              </button>
              <Hint text="AI czyta wszystkie dokumenty z teczki (paszport, karta pobytu, PESEL, konto…) i uzupełnia PUSTE pola kartoteki. Różnice z obecnymi danymi pokazuje jako konflikty do zatwierdzenia." className="self-center" />
            </>
          ) : (
            <>
              <button onClick={() => setSelDocs(selDocs.size === docs.length ? new Set() : new Set(docs.map(d => d.id)))}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                {selDocs.size === docs.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
              </button>
              <button onClick={delSelected} disabled={!selDocs.size || deletingMany}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {deletingMany ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Usuń zaznaczone ({selDocs.size})
              </button>
              <button onClick={exitSelect} disabled={deletingMany} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Anuluj</button>
            </>
          )}
        </div>
      </div>
      {ocrNote && <p className="mb-2 text-xs text-slate-500">{ocrNote}</p>}

      {/* Wynik OCR */}
      {ocr && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Wynik odczytu</p>
            <button onClick={() => setOcr(null)} className="rounded p-0.5 text-slate-400 hover:bg-slate-200"><X size={14} /></button>
          </div>

          {appliedEntries.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-700"><CheckCircle2 size={13} /> Uzupełniono automatycznie:</p>
              <div className="flex flex-wrap gap-1">
                {appliedEntries.map(([f, v]) => (
                  <span key={f} className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-800 ring-1 ring-emerald-200"><b>{fLabel(f)}:</b> {v}</span>
                ))}
              </div>
            </div>
          )}

          {ocr.conflicts.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-amber-700"><AlertTriangle size={13} /> Różnice — zaznacz, co nadpisać odczytem:</p>
              <div className="space-y-1">
                {ocr.conflicts.map(c => (
                  <label key={c.field} className="flex cursor-pointer flex-wrap items-center gap-2 rounded-lg bg-white px-2 py-1.5 text-xs ring-1 ring-slate-200">
                    <input type="checkbox" checked={chosen.has(c.field)} onChange={() => setChosen(p => { const n = new Set(p); n.has(c.field) ? n.delete(c.field) : n.add(c.field); return n; })} />
                    <span className="font-semibold text-slate-700">{fLabel(c.field)}:</span>
                    <span className="text-slate-500">obecnie „{c.current}"</span>
                    <span className="text-slate-400">→</span>
                    <span className="font-medium text-primary-700">OCR: „{c.extracted}"</span>
                  </label>
                ))}
              </div>
              <button onClick={applyConflicts} disabled={!chosen.size || applyingConflicts}
                className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {applyingConflicts ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Nadpisz zaznaczone ({chosen.size})
              </button>
            </div>
          )}

          {appliedEntries.length === 0 && ocr.conflicts.length === 0 && (
            <p className="text-xs text-slate-500">Brak nowych danych — karta pracownika jest zgodna z dokumentami.</p>
          )}

          {problemDocs.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {problemDocs.map(d => (
                <p key={d.id} className="text-[11px] text-slate-400">⚠ {d.filename}: {d.note || d.status}</p>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition ${drag ? 'border-primary-400 bg-primary-50' : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'}`}
      >
        <input ref={inputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }} />
        {uploading ? (
          <span className="flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Wysyłanie…</span>
        ) : (
          <span className="flex flex-col items-center gap-1 text-sm text-slate-500"><Upload size={20} className="text-primary-400" /> Przeciągnij dokumenty tutaj lub kliknij, aby dodać</span>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {loading ? (
          <div className="col-span-full flex justify-center py-6 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
        ) : docs.length === 0 ? (
          <p className="col-span-full py-4 text-center text-sm italic text-slate-300">Brak dokumentów</p>
        ) : docs.map(d => (
          <div key={d.id}
            onClick={selectMode ? () => toggleDoc(d.id) : undefined}
            className={`group relative overflow-hidden rounded-xl border bg-white transition ${selectMode ? 'cursor-pointer' : ''} ${selectMode && selDocs.has(d.id) ? 'border-primary-500 ring-2 ring-primary-300' : 'border-slate-200'}`}>
            {selectMode ? (
              <div className="pointer-events-none block">
                {isImg(d.content_type) && d.url ? (
                  <img src={d.url} alt={d.filename} className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-slate-50 text-slate-300"><FileText size={28} /></div>
                )}
              </div>
            ) : (
              <a href={d.url ?? '#'} target="_blank" rel="noopener noreferrer" className="block">
                {isImg(d.content_type) && d.url ? (
                  <img src={d.url} alt={d.filename} className="h-24 w-full object-cover" />
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-slate-50 text-slate-300"><FileText size={28} /></div>
                )}
              </a>
            )}
            <div className="p-2">
              <p className="truncate text-[11px] font-semibold text-slate-700" title={d.filename}>{d.filename}</p>
              <p className="text-[10px] text-slate-400">{fmtSize(d.size)} · {new Date(d.created_at).toLocaleDateString('pl-PL')}</p>
            </div>
            {selectMode ? (
              <div className="absolute left-1 top-1">
                <input type="checkbox" readOnly checked={selDocs.has(d.id)} className="h-4 w-4 accent-primary-600" />
              </div>
            ) : (
              <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <a href={d.url ?? '#'} target="_blank" rel="noopener noreferrer" className="rounded-md bg-white/90 p-1 text-primary-600 shadow ring-1 ring-slate-200" title="Otwórz"><ExternalLink size={13} /></a>
                {canDelete && <button onClick={() => del(d.id)} className="rounded-md bg-white/90 p-1 text-red-500 shadow ring-1 ring-slate-200" title="Usuń"><Trash2 size={13} /></button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
