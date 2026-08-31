'use client';

import type { Opiekun } from './pipelineTypes';
import { roleLabel } from './pipelineConfig';

// ─── Blok opiekuna (reużywany w karcie i liście) ──────────────────────────────

export function OpiekunBlock({ opiekun, compact = false }: { opiekun?: Opiekun | null; compact?: boolean }) {
  if (!opiekun) {
    return <span className="text-xs text-slate-400 italic">Brak opiekuna</span>;
  }
  return (
    <div className={compact ? '' : 'rounded-xl bg-primary-50/50 px-3 py-2 ring-1 ring-primary-100'}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
        {roleLabel(opiekun.role)}
      </p>
      <p className="text-sm font-semibold text-slate-800 leading-tight">{opiekun.full_name}</p>
      {opiekun.hierarchical_id && (
        <p className="font-mono text-[11px] text-slate-400">ID: {opiekun.hierarchical_id}</p>
      )}
    </div>
  );
}
