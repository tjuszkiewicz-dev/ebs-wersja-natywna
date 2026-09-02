'use client';

import React, { useState } from 'react';
import type { Pracownik, CalcConfig } from '@/lib/agencja/tax-engine/types';
import { Users, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

const TEAL = '#4a95a9';

function newPracownik(): Pracownik {
  return {
    id: crypto.randomUUID(),
    imie: '',
    nazwisko: '',
    typUmowy: 'UOP',
    trybSkladek: 'PELNE',
    choroboweAktywne: true,
    pit2: 300,
    ulgaMlodych: false,
    kupTyp: 'STANDARD',
    nettoDocelowe: 5000,
    nettoZasadnicza: 3606,
    pitMode: 'AUTO',
    skladkaFP: true,
    skladkaFGSP: true,
  };
}

interface Props {
  pracownicy: Pracownik[];
  onPracownicyChange: (p: Pracownik[]) => void;
  config: CalcConfig;
}

function PracownikRow({
  pracownik,
  onUpdate,
  onRemove,
}: {
  pracownik: Pracownik;
  onUpdate: (p: Partial<Pracownik>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-50">
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
          <input
            value={pracownik.imie}
            onChange={e => onUpdate({ imie: e.target.value })}
            placeholder="Imię"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2"
          />
          <input
            value={pracownik.nazwisko}
            onChange={e => onUpdate({ nazwisko: e.target.value })}
            placeholder="Nazwisko"
            className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2"
          />
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 whitespace-nowrap">Netto docel.</span>
            <input
              type="number"
              value={pracownik.nettoDocelowe}
              onChange={e => onUpdate({ nettoDocelowe: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 whitespace-nowrap">Zasadnicza</span>
            <input
              type="number"
              value={pracownik.nettoZasadnicza}
              onChange={e => onUpdate({ nettoZasadnicza: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2"
            />
          </div>
        </div>
        <button
          onClick={() => setExpanded(v => !v)}
          className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors text-slate-500"
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-lg hover:bg-red-100 transition-colors text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Expanded options */}
      {expanded && (
        <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white">
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Typ umowy</label>
            <select
              value={pracownik.typUmowy}
              onChange={e => onUpdate({ typUmowy: e.target.value as 'UOP' | 'UZ' })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none"
            >
              <option value="UOP">UoP</option>
              <option value="UZ">UZ / Zlecenie</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">Tryb ZUS</label>
            <select
              value={pracownik.trybSkladek}
              onChange={e => onUpdate({ trybSkladek: e.target.value as 'PELNE' | 'STUDENT_UZ' | 'INNY_TYTUL' })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none"
            >
              <option value="PELNE">Pełne</option>
              <option value="STUDENT_UZ">Student / UZ</option>
              <option value="INNY_TYTUL">Inny tytuł</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">PIT Mode</label>
            <select
              value={pracownik.pitMode}
              onChange={e => onUpdate({ pitMode: e.target.value as 'AUTO' | 'FLAT_0' | 'FLAT_12' | 'FLAT_32' })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none"
            >
              <option value="AUTO">Auto (progi)</option>
              <option value="FLAT_0">0% (ulga)</option>
              <option value="FLAT_12">12%</option>
              <option value="FLAT_32">32%</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 font-semibold uppercase block mb-1">KUP</label>
            <select
              value={pracownik.kupTyp}
              onChange={e => onUpdate({ kupTyp: e.target.value as 'STANDARD' | 'PODWYZSZONE' | 'PROC_20' | 'PROC_50' })}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none"
            >
              <option value="STANDARD">Standard (250 zł)</option>
              <option value="PODWYZSZONE">Podwyższone (300 zł)</option>
              <option value="PROC_20">20% (UZ)</option>
              <option value="PROC_50">50% (autorskie)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={pracownik.ulgaMlodych}
              onChange={e => onUpdate({ ulgaMlodych: e.target.checked })}
              className="rounded"
            />
            Ulga dla młodych
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={pracownik.choroboweAktywne}
              onChange={e => onUpdate({ choroboweAktywne: e.target.checked })}
              className="rounded"
            />
            Chorobowe aktywne
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={pracownik.skladkaFP}
              onChange={e => onUpdate({ skladkaFP: e.target.checked })}
              className="rounded"
            />
            Składka FP
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={pracownik.skladkaFGSP}
              onChange={e => onUpdate({ skladkaFGSP: e.target.checked })}
              className="rounded"
            />
            Składka FGŚP
          </label>
        </div>
      )}
    </div>
  );
}

function BulkAddBar({ onAdd }: { onAdd: (count: number, netto: number, typ: 'UOP' | 'UZ') => void }) {
  const [count, setCount] = useState<string>('');
  const [netto, setNetto] = useState<string>('');
  const [typ, setTyp]     = useState<'UOP' | 'UZ'>('UOP');

  const handleAdd = () => {
    const c = parseInt(count);
    const n = parseFloat(netto);
    if (!c || c < 1 || !n || n < 1) return;
    onAdd(c, n, typ);
    setCount('');
    setNetto('');
  };

  return (
    <div className="mb-6 p-4 rounded-xl border border-blue-100 bg-blue-50">
      <p className="text-sm text-blue-700 font-medium mb-3">Szybkie dodanie pracowników:</p>

      {/* Preset chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { label: '10 × 5 000 zł', count: 10, netto: 5000 },
          { label: '20 × 6 000 zł', count: 20, netto: 6000 },
          { label: '50 × 7 500 zł', count: 50, netto: 7500 },
        ].map(opt => (
          <button
            key={opt.label}
            onClick={() => onAdd(opt.count, opt.netto, 'UOP')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom inputs */}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Ilość</label>
          <input
            type="number"
            min="1"
            max="999"
            value={count}
            onChange={e => setCount(e.target.value)}
            placeholder="np. 15"
            className="w-24 px-3 py-2 text-sm border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Zarobki netto (zł)</label>
          <input
            type="number"
            min="1"
            step="100"
            value={netto}
            onChange={e => setNetto(e.target.value)}
            placeholder="np. 5500"
            className="w-36 px-3 py-2 text-sm border border-blue-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Typ umowy</label>
          <div className="flex rounded-xl overflow-hidden border border-blue-200">
            {(['UOP', 'UZ'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTyp(t)}
                className={`px-4 py-2 text-xs font-bold transition-colors ${
                  typ === t
                    ? 'text-white'
                    : 'bg-white text-blue-500 hover:bg-blue-50'
                }`}
                style={typ === t ? { backgroundColor: TEAL } : undefined}
              >
                {t === 'UOP' ? 'UoP' : 'UZ'}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={!count || !netto || parseInt(count) < 1 || parseFloat(netto) < 1}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
          style={{ backgroundColor: TEAL }}
        >
          <Plus size={14} />
          Dodaj
        </button>
      </div>
    </div>
  );
}

export function Step1Employees({ pracownicy, onPracownicyChange, config }: Props) {
  const addEmployee = () => onPracownicyChange([...pracownicy, newPracownik()]);

  const updateEmployee = (id: string, patch: Partial<Pracownik>) =>
    onPracownicyChange(pracownicy.map(p => p.id === id ? { ...p, ...patch } : p));

  const removeEmployee = (id: string) =>
    onPracownicyChange(pracownicy.filter(p => p.id !== id));

  const addBulk = (count: number, netto: number, typUmowy: 'UOP' | 'UZ' = 'UOP') => {
    const bulk = Array.from({ length: count }, () => ({
      ...newPracownik(),
      nettoDocelowe: netto,
      nettoZasadnicza: config.minNetto,
      typUmowy,
      kupTyp: (typUmowy === 'UZ' ? 'PROC_20' : 'STANDARD') as Pracownik['kupTyp'],
    }));
    onPracownicyChange([...pracownicy, ...bulk]);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${TEAL}20` }}>
            <Users size={20} style={{ color: TEAL }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Lista pracowników</h2>
            <p className="text-sm text-slate-500">{pracownicy.length} pracownik{pracownicy.length === 1 ? '' : 'ów'} dodanych</p>
          </div>
        </div>
        <button
          onClick={addEmployee}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: TEAL }}
        >
          <Plus size={16} />
          Dodaj pracownika
        </button>
      </div>

      {/* Quick bulk add */}
      <BulkAddBar onAdd={addBulk} />

      <div className="space-y-3">
        {pracownicy.map(p => (
          <PracownikRow
            key={p.id}
            pracownik={p}
            onUpdate={patch => updateEmployee(p.id, patch)}
            onRemove={() => removeEmployee(p.id)}
          />
        ))}
        {pracownicy.length === 0 && (
          <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Dodaj co najmniej jednego pracownika</p>
          </div>
        )}
      </div>
    </div>
  );
}
