import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, ScrollText, RefreshCw } from 'lucide-react';

type LogRow = {
  id: string; table_name: string; operation: string; row_id: string;
  changed_by: string | null; changed_by_name: string; created_at: string;
};
const PAGE = 50;
const OP_COLOR: Record<string, string> = {
  INSERT: 'bg-emerald-50 text-emerald-700', UPDATE: 'bg-amber-50 text-amber-700', DELETE: 'bg-red-50 text-red-700',
};

export default function AdminLogi() {
  const [rows, setRows]   = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [table, setTable]   = useState('');
  const [operation, setOperation] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (table) qs.set('table', table);
    if (operation) qs.set('operation', operation);
    try {
      const res = await fetch(`/api/admin/logs?${qs.toString()}`);
      const d = await res.json();
      if (res.ok) { setRows(Array.isArray(d.rows) ? d.rows : []); setTotal(d.total ?? 0); }
    } finally { setLoading(false); }
  }, [offset, table, operation]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-800 font-bold"><ScrollText size={18}/> Logi systemowe</div>
      <div className="flex flex-wrap items-center gap-2">
        <input value={table} onChange={e => { setOffset(0); setTable(e.target.value.trim()); }}
          placeholder="Tabela (np. voucher_orders)" className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
        <select value={operation} onChange={e => { setOffset(0); setOperation(e.target.value); }}
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm">
          <option value="">Wszystkie operacje</option>
          <option value="INSERT">INSERT</option><option value="UPDATE">UPDATE</option><option value="DELETE">DELETE</option>
        </select>
        <button onClick={load} className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm hover:bg-slate-50">
          <RefreshCw size={13}/> Odśwież
        </button>
        <span className="text-xs text-slate-400 ml-auto">Łącznie: {total}</span>
      </div>
      <div className="border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr><th className="text-left px-4 py-2">Data</th><th className="text-left px-4 py-2">Tabela</th>
            <th className="text-left px-4 py-2">Operacja</th><th className="text-left px-4 py-2">Rekord</th>
            <th className="text-left px-4 py-2">Kto</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400"><Loader2 className="animate-spin inline mr-2" size={16}/>Ładowanie…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Brak logów.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-2 whitespace-nowrap text-slate-500">{new Date(r.created_at).toLocaleString('pl-PL')}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.table_name}</td>
                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${OP_COLOR[r.operation] ?? 'bg-slate-100 text-slate-600'}`}>{r.operation}</span></td>
                <td className="px-4 py-2 font-mono text-[11px] text-slate-500 truncate max-w-[180px]">{r.row_id}</td>
                <td className="px-4 py-2 text-slate-700">{r.changed_by_name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}
          className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">Poprzednie</button>
        <span className="text-slate-400">{offset + 1}–{Math.min(offset + PAGE, total)} z {total}</span>
        <button disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}
          className="px-3 py-1.5 border border-slate-200 rounded-lg disabled:opacity-40">Następne</button>
      </div>
    </div>
  );
}
