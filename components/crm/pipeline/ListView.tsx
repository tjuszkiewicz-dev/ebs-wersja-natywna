'use client';

import { FileText, ChevronRight } from 'lucide-react';
import type { Lead } from './pipelineTypes';
import { STATUS_LABEL, STATUS_BADGE, roleLabel } from './pipelineConfig';

// ─── Widok listy ──────────────────────────────────────────────────────────────

export function ListView({
  leads,
  onNotes,
  onDetails,
}: {
  leads: Lead[];
  onNotes: (l: Lead) => void;
  onDetails: (l: Lead) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3 font-semibold">Nazwa</th>
            <th className="px-4 py-3 font-semibold">NIP</th>
            <th className="px-4 py-3 font-semibold">Opiekun</th>
            <th className="px-4 py-3 font-semibold">Miasto</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold text-right">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-slate-400">Brak klientów.</td>
            </tr>
          )}
          {leads.map(lead => (
            <tr key={lead.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60 transition-colors">
              <td className="px-4 py-3">
                <p className="font-display font-semibold text-slate-900">{lead.name}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{lead.nip || '—'}</td>
              <td className="px-4 py-3">
                {lead.opiekun ? (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600">{roleLabel(lead.opiekun.role)}</p>
                    <p className="text-xs font-semibold text-slate-800">{lead.opiekun.full_name}</p>
                    <p className="font-mono text-[10px] text-slate-400">ID: {lead.opiekun.hierarchical_id}</p>
                  </div>
                ) : (
                  <span className="text-xs italic text-slate-400">Brak opiekuna</span>
                )}
              </td>
              <td className="px-4 py-3 text-slate-600">{lead.city || '—'}</td>
              <td className="px-4 py-3">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[lead.status]}`}>
                  {STATUS_LABEL[lead.status]}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onNotes(lead)}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <FileText size={13} /> Notatki
                  </button>
                  <button
                    onClick={() => onDetails(lead)}
                    className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition-colors"
                  >
                    Szczegóły <ChevronRight size={13} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
