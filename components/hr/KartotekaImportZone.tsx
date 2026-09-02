'use client';
import React, { useState, useCallback, useRef, DragEvent } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle,
  XCircle, Loader2, X, ChevronDown, ChevronUp,
} from 'lucide-react';
import { parseKartotekaFile, HrExcelRow } from '../../utils/excelHr';

interface KartotekaRow extends HrExcelRow {
  isDuplicate: boolean;
}

interface Props {
  companyId: string;
  existingEmails: Set<string>;   // lowercase
  existingPesels: Set<string>;
  onImportSuccess: () => void;
}

type Phase = 'idle' | 'parsed' | 'importing' | 'done';

interface ImportResult {
  imported: number;
  errors: string[];
}

export default function KartotekaImportZone({
  companyId,
  existingEmails,
  existingPesels,
  onImportSuccess,
}: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [rows, setRows] = useState<KartotekaRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setParseError(
        file.name.toLowerCase().endsWith('.xls')
          ? 'Stary format .xls nie jest obsługiwany. Otwórz plik w Excelu lub Arkuszach Google i zapisz jako .xlsx.'
          : 'Nieobsługiwany format. Wgraj plik .xlsx.'
      );
      return;
    }
    setParseError(null);
    try {
      const parsed = await parseKartotekaFile(file);
      const enriched: KartotekaRow[] = parsed.map(r => ({
        ...r,
        isDuplicate:
          existingEmails.has(r.email.toLowerCase()) ||
          (!!r.pesel && existingPesels.has(r.pesel)),
      }));
      setRows(enriched);
      setPhase('parsed');
    } catch (err) {
      // Parser potrafi powiedzieć konkretnie, co jest nie tak (np. stary format) —
      // nie zastępuj tego ogólnikiem, bo użytkownik traci jedyną wskazówkę.
      setParseError(
        err instanceof Error && err.message
          ? err.message
          : 'Nie udało się wczytać pliku. Sprawdź czy jest to prawidłowy plik Excel.'
      );
    }
  }, [existingEmails, existingPesels]);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void processFile(file);
  }, [processFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = '';
  };

  const handleImport = async () => {
    const toImport = rows.filter(r => r.isValid && !r.isDuplicate);
    if (toImport.length === 0) return;
    setPhase('importing');

    const validRows = toImport.map(r => ({
      name:         r.firstName,
      surname:      r.lastName,
      email:        r.email,
      pesel:        r.pesel || undefined,
      department:   r.department || undefined,
      position:     r.position || undefined,
      phoneNumber:  r.phoneNumber || undefined,
      iban:         r.iban || undefined,
      street:       r.street || undefined,
      zipCode:      r.zipCode || undefined,
      city:         r.city || undefined,
      hireDate:     r.hireDate || undefined,
      contractType: r.contractType || undefined,
    }));

    try {
      const res = await fetch('/api/users/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ validRows, companyId }),
      });
      const data = await res.json() as { imported?: number; errors?: string[] };
      setResult({ imported: data.imported ?? 0, errors: data.errors ?? [] });
      setPhase('done');
      if ((data.imported ?? 0) > 0) onImportSuccess();
    } catch {
      setResult({ imported: 0, errors: ['Błąd połączenia z serwerem.'] });
      setPhase('done');
    }
  };

  const reset = () => {
    setPhase('idle');
    setRows([]);
    setResult(null);
    setParseError(null);
    setShowErrors(false);
  };

  const valid      = rows.filter(r => r.isValid && !r.isDuplicate);
  const duplicates = rows.filter(r => r.isDuplicate);
  const errorRows  = rows.filter(r => !r.isValid && !r.isDuplicate);

  // ── IDLE ────────────────────────────────────────────────────────────────────
  if (phase === 'idle') {
    return (
      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl px-6 py-7 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={onFileChange}
        />
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <div className={`p-3 rounded-full transition-colors ${isDragging ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Upload size={22} className={isDragging ? 'text-blue-500' : 'text-gray-400'} />
          </div>
          <p className="text-sm font-medium text-gray-700">
            Przeciągnij i upuść plik <span className="text-blue-600">.xlsx</span> lub kliknij, aby wybrać
          </p>
          <p className="text-xs text-gray-400">
            Użyj szablonu pobranego przyciskiem <strong>Pobierz szablon</strong>
          </p>
        </div>
        {parseError && (
          <p className="mt-3 text-xs text-red-600 font-medium pointer-events-none">{parseError}</p>
        )}
      </div>
    );
  }

  // ── DONE ────────────────────────────────────────────────────────────────────
  if (phase === 'done' && result) {
    return (
      <div className="border rounded-xl bg-white p-5" style={{ borderColor: '#d1d5db' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            {result.imported > 0
              ? <CheckCircle size={22} className="text-emerald-500 shrink-0" />
              : <XCircle size={22} className="text-red-500 shrink-0" />}
            <div>
              <p className="font-semibold text-gray-800 text-sm">
                Import zakończony — dodano{' '}
                <span className="text-emerald-600">{result.imported}</span> pracownik
                {result.imported === 1 ? 'a' : result.imported < 5 ? 'ów' : 'ów'}
              </p>
              {result.errors.length > 0 && (
                <p className="text-xs text-red-500 mt-0.5">
                  {result.errors.length} błędów podczas tworzenia kont
                </p>
              )}
            </div>
          </div>
          <button onClick={reset} className="text-gray-400 hover:text-gray-600 shrink-0">
            <X size={16} />
          </button>
        </div>
        {result.errors.length > 0 && (
          <div className="mt-3 bg-red-50 rounded-lg p-3 space-y-0.5">
            {result.errors.slice(0, 5).map((e, i) => (
              <p key={i} className="text-xs text-red-600">{e}</p>
            ))}
            {result.errors.length > 5 && (
              <p className="text-xs text-red-400">…i {result.errors.length - 5} więcej</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── PARSED / IMPORTING ──────────────────────────────────────────────────────
  return (
    <div className="border rounded-xl bg-white overflow-hidden" style={{ borderColor: '#d1d5db' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-blue-600" />
          <span className="text-sm font-semibold text-gray-800">Podgląd importu</span>
          <span className="text-xs text-gray-400">({rows.length} wierszy w pliku)</span>
        </div>
        <button
          onClick={reset}
          disabled={phase === 'importing'}
          className="text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          <X size={16} />
        </button>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">
          <CheckCircle size={12} /> {valid.length} do importu
        </div>
        {duplicates.length > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
            <AlertTriangle size={12} /> {duplicates.length} duplikat
            {duplicates.length === 1 ? '' : duplicates.length < 5 ? 'y' : 'ów'} — pominięte
          </div>
        )}
        {errorRows.length > 0 && (
          <button
            className="flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-medium hover:bg-red-100 transition-colors"
            onClick={() => setShowErrors(s => !s)}
          >
            <XCircle size={12} /> {errorRows.length} błąd
            {errorRows.length === 1 ? '' : errorRows.length < 5 ? 'y' : 'ów'}
            {showErrors ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {/* Error rows (collapsible) */}
      {showErrors && errorRows.length > 0 && (
        <div className="px-4 py-2 border-b border-gray-100 bg-red-50/50 max-h-40 overflow-y-auto">
          {errorRows.map(r => (
            <div key={r.rowIndex} className="flex items-start gap-2 py-1.5 border-b border-red-100 last:border-0">
              <span className="text-xs text-red-400 font-mono shrink-0 w-16">
                wiersz {r.rowIndex}
              </span>
              <span className="text-xs font-medium text-gray-700 shrink-0 w-36 truncate">
                {r.firstName || r.lastName
                  ? `${r.firstName} ${r.lastName}`.trim()
                  : '(brak danych)'}
              </span>
              <span className="text-xs text-red-600">{r.errors.join(', ')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Valid rows preview */}
      {valid.length > 0 && (
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 12 }}>
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                {['Imię i nazwisko', 'PESEL', 'Email', 'Dział', 'Stanowisko', 'Typ umowy'].map(h => (
                  <th key={h} style={{
                    padding: '7px 10px', textAlign: 'left',
                    borderBottom: '1px solid #e5e7eb',
                    color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {valid.map(r => (
                <tr key={r.rowIndex} className="hover:bg-gray-50">
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6' }}>
                    {r.firstName} {r.lastName}
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', fontFamily: 'monospace' }}>
                    {r.pesel}
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>
                    {r.email}
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>
                    {r.department || '—'}
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>
                    {r.position || '—'}
                  </td>
                  <td style={{ padding: '6px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}>
                    {r.contractType || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Duplicate list */}
      {duplicates.length > 0 && (
        <div className="px-4 py-2 bg-amber-50/50 border-t border-amber-100">
          <p className="text-xs text-amber-700 font-medium mb-1">Pominięci (już w kartotece):</p>
          <p className="text-xs text-amber-600">
            {duplicates.slice(0, 8).map(r => `${r.firstName} ${r.lastName}`).join(', ')}
            {duplicates.length > 8 ? ` …i ${duplicates.length - 8} więcej` : ''}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          {valid.length === 0
            ? 'Brak wierszy gotowych do importu'
            : `Zostanie utworzonych ${valid.length} kont pracowniczych`}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            disabled={phase === 'importing'}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded disabled:opacity-40"
          >
            Anuluj
          </button>
          <button
            onClick={() => void handleImport()}
            disabled={valid.length === 0 || phase === 'importing'}
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {phase === 'importing' && <Loader2 size={14} className="animate-spin" />}
            Importuj {valid.length > 0 ? valid.length : ''} pracownik
            {valid.length === 1 ? 'a' : 'ów'}
          </button>
        </div>
      </div>
    </div>
  );
}
