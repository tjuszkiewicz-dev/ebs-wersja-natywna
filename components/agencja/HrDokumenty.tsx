'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, FolderOpen, ChevronRight, Search, Hourglass } from 'lucide-react';
import { HrEmployeeDocs } from './HrEmployeeDocs';
import { fullName } from '@/lib/hr/docPlaceholders';

interface Employee { id: string; first_name: string; last_name: string; country_of_origin?: string | null; candidate?: boolean; }

export function HrDokumenty() {
  const [list, setList] = useState<Employee[]>([]);
  const [candidates, setCandidates] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [search, setSearch] = useState('');
  const match = (e: Employee) => !search.trim() || fullName(e).toLowerCase().includes(search.toLowerCase().trim());
  const filtered = list.filter(match);
  const filteredCand = candidates.filter(match);

  useEffect(() => {
    Promise.all([
      fetch('/api/hr/employees', { credentials: 'same-origin' }).then(r => (r.ok ? r.json() : { employees: [] })),
      fetch('/api/hr/employees?candidates=1', { credentials: 'same-origin' }).then(r => (r.ok ? r.json() : { employees: [] })),
    ])
      .then(([de, dc]) => { setList(de.employees || []); setCandidates((dc.employees || []).map((c: any) => ({ ...c, candidate: true }))); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const Row = ({ e }: { e: Employee }) => (
    <button onClick={() => setSelected(e)}
      className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left transition ${selected?.id === e.id ? 'bg-primary-50 ring-1 ring-primary-200' : 'hover:bg-slate-50'}`}>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{fullName(e)}</p>
        {e.country_of_origin && <p className="text-xs text-slate-400">{e.country_of_origin}</p>}
      </div>
      <ChevronRight size={15} className="shrink-0 text-slate-300" />
    </button>
  );

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-sans text-lg font-bold text-slate-900">Dokumenty pracowników</h2>
        <p className="text-sm text-slate-500">Wybierz pracownika lub kandydata i przeciągnij jego dokumenty (paszport, karta pobytu, pozwolenie na pracę, PESEL, dokumenty bankowe…)</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Lista: kandydaci (Poczekalnia) + pracownicy */}
        <div className="rounded-2xl border border-slate-200 bg-white p-2 lg:col-span-1">
          <div className="relative mb-2 px-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          {loading ? (
            <div className="flex justify-center py-8 text-slate-400"><Loader2 size={20} className="animate-spin" /></div>
          ) : (
            <div className="max-h-[520px] overflow-y-auto">
              {/* Dokumenty kandydatów (Poczekalnia) */}
              {filteredCand.length > 0 && (
                <>
                  <p className="mt-1 flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-600"><Hourglass size={12} /> Dokumenty kandydatów ({filteredCand.length})</p>
                  {filteredCand.map(e => <Row key={e.id} e={e} />)}
                  <div className="my-2 border-t border-slate-100" />
                </>
              )}
              <p className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><FolderOpen size={12} /> Pracownicy ({filtered.length})</p>
              {filtered.length === 0 && filteredCand.length === 0 ? (
                <p className="py-6 text-center text-sm italic text-slate-300">{list.length + candidates.length === 0 ? 'Brak pracowników — dodaj w „Kontraktach" lub zgłoś kandydata w „Poczekalni"' : 'Brak pasujących osób'}</p>
              ) : filtered.map(e => <Row key={e.id} e={e} />)}
            </div>
          )}
        </div>

        {/* Dokumenty wybranej osoby */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
          {selected ? (
            <>
              <p className="mb-3 flex items-center gap-2 font-sans font-bold text-slate-900">
                <FolderOpen size={16} className="text-primary-500" /> {fullName(selected)}
                {selected.candidate && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">kandydat — Poczekalnia</span>}
              </p>
              <HrEmployeeDocs employeeId={selected.id} />
            </>
          ) : (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 text-slate-300">
              <FolderOpen size={36} strokeWidth={1.2} />
              <p className="text-sm">Wybierz osobę z listy</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
