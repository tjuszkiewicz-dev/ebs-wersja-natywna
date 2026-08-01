'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Archive, ArchiveRestore, Loader2, Search, ChevronRight, User } from 'lucide-react';
import { HrEmployeePanel, type Employee, type ContractLite } from './HrEmployeePanel';
import { fullName } from '@/lib/hr/docPlaceholders';
import { Hint } from '@/components/ui/Hint';

const fmtDate = (s?: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pl-PL');
};

export function HrArchiwum() {
  const [list, setList] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<ContractLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreContract, setRestoreContract] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [re, rc] = await Promise.all([
        fetch('/api/hr/employees?archived=1', { credentials: 'same-origin' }),
        fetch('/api/hr/contracts', { credentials: 'same-origin' }),
      ]);
      const de = re.ok ? await re.json() : { employees: [] };
      const dc = rc.ok ? await rc.json() : { contracts: [] };
      setList(de.employees || []);
      setContracts((dc.contracts || []).map((c: any) => ({ id: c.id, name: c.name })));
    } catch { /* */ } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const restore = async (e: Employee) => {
    if (e.blacklisted && !confirm(`„${fullName(e)}" jest na CZARNEJ LIŚCIE${e.blacklist_reason ? ` (powód: ${e.blacklist_reason})` : ''}.\n\nPrzywrócenie ZDEJMIE flagę czarnej listy. Kontynuować?`)) return;
    setRestoring(e.id);
    try {
      const contractId = restoreContract[e.id] || '';
      const r = await fetch(`/api/hr/employees/${e.id}/archive`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(contractId ? { action: 'restore', contract_id: contractId } : { action: 'restore' }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { alert(d.error || 'Błąd przywracania'); return; }
      if (!d.restored_to_contract) alert('Przywrócono BEZ kontraktu (dawny już nie istnieje) — przypisz go w karcie pracownika w zakładce Kontrakty.');
      await load();
    } finally { setRestoring(null); }
  };

  const filtered = list.filter(e => !search.trim() || fullName(e).toLowerCase().includes(search.toLowerCase().trim()));
  const blacklist = filtered.filter(e => e.blacklisted);
  const normal = filtered.filter(e => !e.blacklisted);

  const Row = ({ e, danger }: { e: Employee; danger?: boolean }) => (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${danger ? 'hover:bg-red-50/50' : 'hover:bg-slate-50/50'}`}>
      <button onClick={() => setSelected(e)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${danger ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-400'}`}><User size={16} /></div>
        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${danger ? 'text-red-700' : 'text-slate-800'}`}>{fullName(e)}</p>
          <p className={`text-xs ${danger ? 'text-red-500' : 'text-slate-400'}`}>
            {danger && e.blacklist_reason ? `⛔ ${e.blacklist_reason} · ` : ''}
            {e.archived_from ? `był w: ${e.archived_from}` : 'bez kontraktu'}{(e as any).archive_reason ? ` · przyczyna: ${(e as any).archive_reason}` : ''} · zarchiwizowany {fmtDate(e.archived_at)}
          </p>
        </div>
      </button>
      {!e.candidate && contracts.length > 0 && (
        <select
          value={restoreContract[e.id] ?? ''}
          onChange={ev => setRestoreContract(m => ({ ...m, [e.id]: ev.target.value }))}
          title="Kontrakt, do którego wróci pracownik (domyślnie: dawny kontrakt, jeśli nadal istnieje)"
          className="shrink-0 rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <option value="">— dawny kontrakt —</option>
          {contracts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      )}
      <button onClick={() => restore(e)} disabled={restoring === e.id}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
        {restoring === e.id ? <Loader2 size={13} className="animate-spin" /> : <ArchiveRestore size={13} />} Przywróć
      </button>
      <Hint text="Przywraca osobę z Archiwum: domyślnie wraca do dawnego kontraktu (jeśli istnieje) — możesz wybrać inny z listy obok. Kandydat wraca do Poczekalni. U oflagowanych zdejmuje czarną listę po potwierdzeniu." className="self-center" />
      <button onClick={() => setSelected(e)} className="shrink-0 rounded-lg p-1.5 text-slate-300 hover:bg-slate-100 hover:text-slate-600"><ChevronRight size={16} /></button>
    </div>
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 font-sans text-lg font-bold text-slate-900"><Archive size={18} className="text-primary-500" /> Archiwum pracowników</h2>
        <p className="text-sm text-slate-500">Pracownicy usunięci z kontraktów — z pełną historią (dane, dokumenty, rozliczenia, grafik). Możesz ich przywrócić w każdej chwili.</p>
      </div>

      <div className="relative mb-3 max-w-md">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj w archiwum…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-slate-400"><Loader2 size={22} className="animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 py-12 text-center text-sm italic text-slate-300">
          {list.length === 0 ? 'Archiwum jest puste — pracownicy trafiają tu po „Usuń z kontraktu"' : 'Brak pasujących pracowników'}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Sektor: CZARNA LISTA */}
          {blacklist.length > 0 && (
            <div className="overflow-hidden rounded-2xl border-2 border-red-300 bg-white">
              <p className="border-b border-red-100 bg-red-600 px-4 py-2.5 text-sm font-bold text-white">⛔ Czarna lista ({blacklist.length}) — osoby oflagowane; przy próbie ponownego zgłoszenia system zablokuje</p>
              <div className="divide-y divide-red-50">
                {blacklist.map(e => <Row key={e.id} e={e} danger />)}
              </div>
            </div>
          )}
          {/* Zwykłe archiwum */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {blacklist.length > 0 && <p className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700">Archiwum ({normal.length})</p>}
            <div className="divide-y divide-slate-50">
              {normal.length === 0 ? <p className="px-4 py-6 text-center text-sm italic text-slate-300">Brak pracowników w zwykłym archiwum</p>
                : normal.map(e => <Row key={e.id} e={e} />)}
            </div>
          </div>
        </div>
      )}

      {selected && (
        <HrEmployeePanel
          employee={selected}
          contracts={contracts}
          mode="archived"
          onClose={() => setSelected(null)}
          onChanged={e => { setSelected(e); load(); }}
          onDeleted={() => { setSelected(null); load(); }}
        />
      )}
    </div>
  );
}
