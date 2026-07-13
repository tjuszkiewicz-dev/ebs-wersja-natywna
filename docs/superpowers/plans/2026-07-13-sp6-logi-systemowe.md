# SP6 — Logi systemowe: strona + sidebar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development lub superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Superadmin widzi w panelu tabelę logów systemowych (nad istniejącą tabelą `audit_log`), z filtrami i paginacją, dostępną z pozycji sidebara „Logi systemowe".

**Architecture:** Tabela `audit_log` (wypełniana automatycznie przez triggery `fn_audit_log`) już istnieje. Dodajemy tylko odczyt: `GET /api/admin/logs` (superadmin, `supabaseServer` = service_role omija RLS) z filtrami + paginacją i wzbogaceniem `changed_by` o nazwę użytkownika, oraz widok `AdminLogi` wpięty jako nowa zakładka admina `admin-logi` (identycznie jak `admin-szablony` w SP3).

**Tech Stack:** Next.js 15 App Router, Supabase, TypeScript, React, Zod, lucide-react.

## Global Constraints

- `audit_log` kolumny: `id, table_name, operation ('INSERT'|'UPDATE'|'DELETE'), row_id, changed_by (uuid→auth.users), old_data jsonb, new_data jsonb, created_at`.
- Dostęp tylko **superadmin**; `supabaseServer()` (service_role) omija RLS — to jedyna warstwa autoryzacji, więc gate w route jest obowiązkowy.
- Brak nowej migracji (tabela istnieje). Brak testów jednostkowych (route/React — brak infry); kroki = `tsc`+`build`+weryfikacja manualna.
- Nowa zakładka wpięta w 6 miejscach (Sidebar + `DashboardAdminNew`: union, `VIEW_TO_TAB`, `TAB_TO_VIEW`, `tabs`, switch, import) — wzór jak `admin-szablony`.
- `npx tsc --noEmit` = 0; `npm run build` = sukces.

---

### Task 1: `GET /api/admin/logs` (superadmin, filtry + paginacja)

**Files:**
- Create: `app/api/admin/logs/route.ts`

**Interfaces:**
- Produces: `GET` zwraca `{ rows: Array<{id, table_name, operation, row_id, changed_by, changed_by_name, created_at}>, total: number, limit, offset }`. Query params: `table` (opcjonalny), `operation` (opcjonalny), `limit` (domyślnie 50, max 200), `offset` (domyślnie 0).

- [ ] **Step 1: implement**
```ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const table     = sp.get('table') || undefined;
  const operation = sp.get('operation') || undefined;
  const limit  = Math.min(Math.max(parseInt(sp.get('limit')  || '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);

  const supabase = supabaseServer();
  let query = supabase
    .from('audit_log')
    .select('id, table_name, operation, row_id, changed_by, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);
  if (table)     query = query.eq('table_name', table);
  if (operation) query = query.eq('operation', operation);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  // Wzbogać changed_by o nazwę (jedno zapytanie na unikalne id)
  const ids = [...new Set(rows.map(r => r.changed_by).filter(Boolean) as string[])];
  const nameById = new Map<string, string>();
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('user_profiles').select('id, full_name').in('id', ids);
    for (const p of profiles ?? []) nameById.set(p.id as string, (p as any).full_name ?? '');
  }

  return NextResponse.json({
    rows: rows.map(r => ({ ...r, changed_by_name: r.changed_by ? (nameById.get(r.changed_by) ?? '—') : 'system' })),
    total: count ?? 0,
    limit, offset,
  });
}
```
- [ ] **Step 2: typecheck** `npx tsc --noEmit` → brak błędów w pliku.
- [ ] **Step 3: manual verify (dev)** — jako superadmin `GET /api/admin/logs?limit=5` → `{rows:[...], total}`; jako pracownik → 403.
- [ ] **Step 4: commit**
```bash
git add app/api/admin/logs/route.ts
git commit -m "feat(api): admin/logs - odczyt audit_log z filtrami i paginacja (superadmin)"
```

---

### Task 2: `AdminLogi.tsx` — tabela logów

**Files:**
- Create: `components/adminNew/AdminLogi.tsx`

**Interfaces:**
- Consumes: `GET /api/admin/logs?table&operation&limit&offset`.

- [ ] **Step 1: implement**
```tsx
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
```
- [ ] **Step 2: typecheck** `npx tsc --noEmit` → brak błędów.
- [ ] **Step 3: commit**
```bash
git add components/adminNew/AdminLogi.tsx
git commit -m "feat(ui): AdminLogi - tabela logow systemowych z filtrami i paginacja"
```

---

### Task 3: Wpięcie zakładki `admin-logi`

**Files:**
- Modify: `views/DashboardAdminNew.tsx`
- Modify: `components/Sidebar.tsx`

**Interfaces:**
- Consumes: `AdminLogi` (Task 2).

- [ ] **Step 1: `views/DashboardAdminNew.tsx`** — 6 edycji (wzór jak istniejące `admin-szablony`/`szablony`):
  1. import: `import AdminLogi from '../components/adminNew/AdminLogi';` (dopasuj ścieżkę do innych adminNew importów w tym pliku).
  2. `AdminTab` union: dodaj `| 'logi'`.
  3. `VIEW_TO_TAB`: dodaj `'admin-logi': 'logi',`.
  4. `TAB_TO_VIEW`: dodaj `logi: 'admin-logi',`.
  5. `tabs` array: dodaj `{ id: 'logi', label: 'Logi', icon: <ScrollText size={16} /> }` (zaimportuj `ScrollText` z `lucide-react`, jeśli brak; dopasuj kształt obiektu i rozmiar ikony do innych wpisów).
  6. content switch: dodaj `{tab === 'logi' && <AdminLogi />}`.
- [ ] **Step 2: `components/Sidebar.tsx`** — do SUPERADMIN menu dodaj `{ id: 'admin-logi', label: 'Logi systemowe', icon: <ScrollText size={20} /> }` (zaimportuj `ScrollText`, jeśli brak; dopasuj kształt/rozmiar do innych pozycji).
- [ ] **Step 3: typecheck + build** — `npx tsc --noEmit` → 0; `npm run build` → sukces.
- [ ] **Step 4: manual verify (dev)** — jako superadmin: sidebar „Logi systemowe" → tabela logów; filtr po tabeli/operacji działa; paginacja działa.
- [ ] **Step 5: commit**
```bash
git add views/DashboardAdminNew.tsx components/Sidebar.tsx
git commit -m "feat(ui): zakladka 'Logi systemowe' w panelu admina (sidebar + DashboardAdminNew)"
```

---

### Task 4: Dokumentacja + finalna weryfikacja

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: notka CLAUDE.md** — dopisz w sekcji panelu admina: „Logi systemowe: Admin → „Logi systemowe" (tab `admin-logi`, `components/adminNew/AdminLogi.tsx`) czyta `audit_log` przez `GET /api/admin/logs` (superadmin, filtry `table`/`operation` + paginacja). `audit_log` wypełniany automatycznie przez triggery `fn_audit_log`."
- [ ] **Step 2: pełna weryfikacja** — `npx vitest run` → zielone; `npx tsc --noEmit` → 0; `npm run build` → sukces.
- [ ] **Step 3: commit**
```bash
git add CLAUDE.md
git commit -m "docs: logi systemowe - strona + sidebar (SP6)"
```

---

## Self-Review
- **Spec coverage:** `GET /api/admin/logs` z filtrami+paginacją [Task 1], widok `AdminLogi` [Task 2], pozycja sidebara `admin-logi` + wpięcie [Task 3]. Pokryte. Zdarzenia aplikacyjne odkupu/maili/paczki (log app-level) należą do SP5 — poza SP6.
- **Placeholder scan:** brak — cały kod podany.
- **Type consistency:** `AdminLogi` (Task 2) importowany w Task 3; `admin-logi`/`logi` spójne w Sidebar + DashboardAdminNew; API kształt (`rows`,`total`) zgodny z typem `LogRow` w widoku.
- **Uwaga:** brak nowej migracji (tabela `audit_log` istnieje); brak testów jednostkowych (route/React — zgodnie z realiami repo).
