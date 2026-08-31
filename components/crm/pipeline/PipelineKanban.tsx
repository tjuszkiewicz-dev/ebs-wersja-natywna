'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, KanbanSquare, List, Users, RefreshCw,
} from 'lucide-react';
import ActivityPanel from './ActivityPanel';
import type { Lead, LeadStatus } from './pipelineTypes';
import { COLUMNS } from './pipelineConfig';
import { LeadCard } from './LeadCard';
import { DetailsPanel } from './DetailsPanel';
import { AddLeadForm } from './AddLeadForm';
import { ListView } from './ListView';

// ─── Komponent główny ─────────────────────────────────────────────────────────

type ViewMode = 'kanban' | 'list';

export default function PipelineKanban() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('kanban');
  const [search, setSearch] = useState('');
  const [fromMyLeadowcy, setFromMyLeadowcy] = useState(false);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [notesLead, setNotesLead] = useState<Lead | null>(null);

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<LeadStatus | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const url = fromMyLeadowcy ? '/api/crm/leads?from_my_leadowcy=1' : '/api/crm/leads';
      const res = await fetch(url, { credentials: 'same-origin' });
      if (res.ok) {
        const data = await res.json();
        setLeads(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [fromMyLeadowcy]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── Drag & drop: optymistyczna zmiana + PATCH, cofnięcie przy błędzie ──
  const handleDrop = async (targetStatus: LeadStatus) => {
    const id = draggedId;
    setDraggedId(null);
    setDragOverCol(null);
    if (!id) return;

    const lead = leads.find(l => l.id === id);
    if (!lead || lead.status === targetStatus) return;

    const prevStatus = lead.status;
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status: targetStatus } : l)));

    try {
      const res = await fetch(`/api/crm/leads/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) throw new Error('PATCH failed');
      const updated: Lead = await res.json().catch(() => null as unknown as Lead);
      if (updated && updated.id) {
        setLeads(prev => prev.map(l => (l.id === id ? { ...l, ...updated } : l)));
      }
    } catch {
      // cofnij
      setLeads(prev => prev.map(l => (l.id === id ? { ...l, status: prevStatus } : l)));
    }
  };

  const handleDeleted = (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      l =>
        l.name.toLowerCase().includes(q) ||
        (l.nip ?? '').toLowerCase().includes(q),
    );
  }, [leads, search]);

  const byStatus = useCallback(
    (status: LeadStatus) => filtered.filter(l => l.status === status),
    [filtered],
  );

  const inputCls =
    'rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400 transition';

  return (
    <div className="min-h-full rounded-2xl bg-[#f3f7fa] p-4 md:p-6 font-sans">
      {/* ── Górny pasek ── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Klienci w obsłudze</h1>
          <p className="text-sm text-slate-500">
            {loading ? 'Ładowanie…' : `${filtered.length} ${fromMyLeadowcy ? 'leadów od leadowców' : 'klientów'}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Szukaj */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj po nazwie / NIP…"
              className={`${inputCls} w-56 pl-9`}
            />
          </div>

          {/* Toggle leadowcy */}
          <button
            onClick={() => setFromMyLeadowcy(v => !v)}
            className={[
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
              fromMyLeadowcy
                ? 'bg-secondary-400 text-background shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            ].join(' ')}
            title="Pokaż leady od moich leadowców"
          >
            <Users size={15} />
            Leady od moich leadowców
          </button>

          {/* Odśwież */}
          <button
            onClick={fetchLeads}
            className="rounded-xl bg-white p-2.5 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 transition-colors"
            title="Odśwież"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Przełącznik Lista / Kanban */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setView('list')}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all',
                view === 'list' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <List size={15} /> Lista
            </button>
            <button
              onClick={() => setView('kanban')}
              className={[
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-all',
                view === 'kanban' ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              <KanbanSquare size={15} /> Kanban
            </button>
          </div>
        </div>
      </div>

      {/* Baner trybu leadowców */}
      {fromMyLeadowcy && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-secondary-50 px-4 py-2.5 text-sm font-medium text-secondary-700 ring-1 ring-secondary-200">
          <Users size={15} />
          Tryb leadowców: wyświetlasz klientów pozyskanych przez Twoich leadowców.
        </div>
      )}

      {/* ── Układ: formularz + treść ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Lewa kolumna: formularz (sticky) */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <AddLeadForm onCreated={fetchLeads} />
        </div>

        {/* Prawa kolumna: kanban / lista */}
        <div>
          {view === 'kanban' ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              {COLUMNS.map(col => {
                const colLeads = byStatus(col.id);
                const isOver = dragOverCol === col.id;
                return (
                  <div key={col.id} className="w-72 shrink-0">
                    {/* Nagłówek kolumny */}
                    <div className="mb-3 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                        <span className="font-display text-sm font-bold text-slate-700">{col.label}</span>
                      </div>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
                        {colLeads.length}
                      </span>
                    </div>

                    {/* Dropzone */}
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOverCol(col.id); }}
                      onDragLeave={() => setDragOverCol(prev => (prev === col.id ? null : prev))}
                      onDrop={() => handleDrop(col.id)}
                      className={[
                        'min-h-[12rem] space-y-3 rounded-2xl p-3 transition-all',
                        col.tint,
                        isOver ? `border-2 border-dashed ${col.ring} ring-2 ring-primary-200` : `border border-transparent`,
                      ].join(' ')}
                    >
                      {colLeads.map(lead => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          dragging={draggedId === lead.id}
                          onDragStart={e => {
                            e.dataTransfer.effectAllowed = 'move';
                            setDraggedId(lead.id);
                          }}
                          onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                          onNotes={() => setNotesLead(lead)}
                          onDetails={() => setSelectedLead(lead)}
                        />
                      ))}
                      {colLeads.length === 0 && (
                        <div className="grid place-items-center py-8 text-xs text-slate-400">
                          {loading ? 'Ładowanie…' : 'Brak klientów'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <ListView
              leads={filtered}
              onNotes={l => setNotesLead(l)}
              onDetails={l => setSelectedLead(l)}
            />
          )}
        </div>
      </div>

      {/* Notatki popover */}
      {notesLead && <ActivityPanel lead={notesLead} onClose={() => setNotesLead(null)} />}

      {/* Panel szczegółów */}
      <DetailsPanel
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onDeleted={handleDeleted}
        onUpdated={(updated) => {
          // zachowaj opiekuna (PATCH nie zwraca joinu), odśwież tablicę
          setSelectedLead(prev => (prev ? { ...prev, ...updated } : updated));
          fetchLeads();
        }}
      />
    </div>
  );
}
