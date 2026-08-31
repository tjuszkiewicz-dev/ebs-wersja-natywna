'use client';

import React from 'react';
import { MapPin, FileText, ChevronRight } from 'lucide-react';
import type { Lead } from './pipelineTypes';
import { OpiekunBlock } from './OpiekunBlock';

// ─── Karta klienta (Kanban) ───────────────────────────────────────────────────

export function LeadCard({
  lead,
  onDragStart,
  onDragEnd,
  onNotes,
  onDetails,
  dragging,
}: {
  lead: Lead;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onNotes: () => void;
  onDetails: () => void;
  dragging: boolean;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={[
        'group rounded-2xl bg-white border border-slate-200 p-4 cursor-grab active:cursor-grabbing',
        'shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary-200',
        dragging ? 'opacity-40 rotate-1' : 'opacity-100',
      ].join(' ')}
    >
      {/* Nagłówek */}
      <div className="mb-3">
        <h4 className="font-display font-bold text-slate-900 leading-snug">{lead.name}</h4>
        {lead.nip && (
          <p className="font-mono text-xs text-slate-400 mt-0.5">NIP: {lead.nip}</p>
        )}
      </div>

      {/* Opiekun */}
      <div className="mb-3">
        <OpiekunBlock opiekun={lead.opiekun} />
      </div>

      {/* Miasto */}
      {lead.city && (
        <p className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
          <MapPin size={13} className="text-slate-400" />
          {lead.city}
        </p>
      )}

      {/* Akcje */}
      <div className="flex gap-2 pt-3 border-t border-slate-100">
        <button
          onClick={onNotes}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <FileText size={13} /> Notatki
        </button>
        <button
          onClick={onDetails}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition-colors"
        >
          Szczegóły <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
