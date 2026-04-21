import React, { useState, useMemo } from 'react';
import {
  UserCheck, UserX, ShieldOff, Pencil, Check, X, ChevronDown, ChevronUp,
  Search, Mail, Phone, CreditCard, FileText,
} from 'lucide-react';
import { formatDate } from '../../utils/formatters';

// ── Typy ─────────────────────────────────────────────────────────────────────

export interface AdminEmployee {
  id:            string;
  full_name:     string | null;
  email:         string;
  pesel:         string | null;
  phone_number:  string | null;
  department:    string | null;
  position:      string | null;
  contract_type: 'UOP' | 'UZ' | null;
  hire_date:     string | null;
  status:        'active' | 'inactive' | 'anonymized';
  iban:          string | null;
  iban_verified: boolean;
  created_at:    string;
}

interface Props {
  employees: AdminEmployee[];
  onRefresh: () => void;
}

interface EditState {
  full_name:     string;
  department:    string;
  position:      string;
  phone_number:  string;
  contract_type: 'UOP' | 'UZ';
}

// ── Detail row helper ─────────────────────────────────────────────────────────

const EmpDetailRow: React.FC<{
  label: string;
  value?: string | null;
  mono?:  boolean;
  small?: boolean;
}> = ({ label, value, mono, small }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-1.5 mb-1.5">
      <span className="text-[10px] text-gray-400 w-20 shrink-0 pt-0.5">{label}</span>
      <span className={`text-xs text-gray-700 break-all ${mono ? 'font-mono' : ''} ${small ? 'text-[10px]' : ''}`}>
        {value}
      </span>
    </div>
  );
};

// ── Inline edit form ──────────────────────────────────────────────────────────

const EditForm: React.FC<{
  emp:      AdminEmployee;
  onSaved:  () => void;
  onCancel: () => void;
}> = ({ emp, onSaved, onCancel }) => {
  const [form, setForm] = useState<EditState>({
    full_name:     emp.full_name ?? '',
    department:    emp.department ?? '',
    position:      emp.position ?? '',
    phone_number:  emp.phone_number ?? '',
    contract_type: emp.contract_type ?? 'UOP',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/users/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:     form.full_name || undefined,
          department:    form.department || undefined,
          position:      form.position  || undefined,
          phone_number:  form.phone_number || undefined,
          contract_type: form.contract_type,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onSaved();
    } catch (e: any) {
      setErr(e.message ?? 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const inp = (key: keyof EditState, placeholder?: string) => (
    <input
      value={form[key]}
      onChange={e => setForm({ ...form, [key]: e.target.value })}
      placeholder={placeholder}
      className="w-full px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
    />
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">Imię i nazwisko</label>
        {inp('full_name', 'Imię i nazwisko')}
      </div>
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">Telefon</label>
        {inp('phone_number', 'Telefon')}
      </div>
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">Dział</label>
        {inp('department', 'Dział')}
      </div>
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">Stanowisko</label>
        {inp('position', 'Stanowisko')}
      </div>
      <div>
        <label className="text-[10px] text-gray-500 mb-0.5 block">Typ umowy</label>
        <select
          value={form.contract_type}
          onChange={e => setForm({ ...form, contract_type: e.target.value as 'UOP' | 'UZ' })}
          className="w-full px-2 py-1 border border-blue-300 rounded text-xs focus:outline-none"
        >
          <option value="UOP">Umowa o pracę</option>
          <option value="UZ">Umowa Zlecenie</option>
        </select>
      </div>
      <div className="flex items-end gap-2">
        {err && <p className="text-red-500 text-[10px]">{err}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 text-xs text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-60"
        >
          <Check size={12} /> Zapisz
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded hover:bg-gray-100 transition-colors"
        >
          <X size={12} /> Anuluj
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const AdminEmployeeTable: React.FC<Props> = ({ employees, onRefresh }) => {
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [actionId,     setActionId]     = useState<string | null>(null);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'inactive'>('ALL');

  const filtered = useMemo(() => {
    let list = employees;
    if (statusFilter !== 'ALL') list = list.filter(e => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.full_name ?? '').toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.pesel ?? '').includes(q) ||
        (e.department ?? '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, search, statusFilter]);

  const counts = useMemo(() => ({
    all:      employees.length,
    active:   employees.filter(e => e.status === 'active').length,
    inactive: employees.filter(e => e.status === 'inactive').length,
  }), [employees]);

  const doAction = async (empId: string, action: 'activate' | 'deactivate' | 'anonymize') => {
    setActionId(empId);
    try {
      const url    = action === 'anonymize' ? `/api/users/${empId}/anonymize` : `/api/users/${empId}/${action}`;
      const method = action === 'anonymize' ? 'POST' : 'PATCH';
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) {
        const d = await res.json();
        alert(d.error ?? `Błąd (${res.status})`);
        return;
      }
      setExpandedId(null);
      onRefresh();
    } finally {
      setActionId(null);
    }
  };

  const contractLabel = (ct: AdminEmployee['contract_type']) =>
    ct === 'UZ' ? 'Umowa Zlecenie' : 'Umowa o pracę';

  return (
    <div className="space-y-3">

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj po nazwisku, PESEL, emailu..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1">
          {([
            { key: 'ALL',      label: 'Wszyscy',     count: counts.all },
            { key: 'active',   label: 'Aktywni',     count: counts.active },
            { key: 'inactive', label: 'Nieaktywni',  count: counts.inactive },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-colors ${
                statusFilter === f.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
              <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                statusFilter === f.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
              }`}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg overflow-hidden shadow-sm" style={{ border: '1px solid #d1d5db' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1e3a5f' }}>
                {['LP', 'Imię i nazwisko', 'PESEL', 'Adres e-mail', 'Telefon', 'Dział', 'Stanowisko', 'Typ umowy', 'Status', ''].map((h, i) => (
                  <th key={i} style={{
                    border: '1px solid #16304f', padding: '9px 11px',
                    color: '#fff', fontWeight: 600, fontSize: 11,
                    textAlign: i === 0 ? 'center' : i === 8 ? 'center' : 'left',
                    whiteSpace: 'nowrap',
                    width: i === 0 ? 44 : i === 9 ? 36 : undefined,
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: '32px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px solid #e5e7eb', background: '#fff' }}>
                    Brak pracowników.
                  </td>
                </tr>
              ) : (
                filtered.map((emp, idx) => {
                  const isExpanded = expandedId === emp.id;
                  const isEditing  = editingId  === emp.id;
                  const isBusy     = actionId   === emp.id;
                  const isActive   = emp.status === 'active';
                  const isAnon     = emp.status === 'anonymized';
                  const rowBg      = isExpanded ? '#eff6ff' : idx % 2 === 0 ? '#ffffff' : '#f9fafb';

                  const cell = (extra?: React.CSSProperties): React.CSSProperties => ({
                    border: '1px solid #e5e7eb',
                    padding: '7px 11px',
                    background: rowBg,
                    ...extra,
                  });

                  return (
                    <React.Fragment key={emp.id}>
                      <tr
                        onClick={() => { setExpandedId(isExpanded ? null : emp.id); setEditingId(null); }}
                        style={{ cursor: 'pointer', opacity: isActive || isAnon ? 1 : 0.65, borderLeft: isExpanded ? '3px solid #3b82f6' : undefined }}
                        className="hover:bg-blue-50 transition-colors"
                      >
                        <td style={{ ...cell(), textAlign: 'center', color: '#9ca3af', borderLeft: isExpanded ? '3px solid #3b82f6' : '1px solid #e5e7eb' }}>{idx + 1}</td>
                        <td style={cell({ fontWeight: 500, color: '#111827' })}>{emp.full_name ?? '—'}</td>
                        <td style={cell({ fontFamily: 'monospace', fontSize: 11, color: '#6b7280' })}>{emp.pesel ?? '—'}</td>
                        <td style={cell({ color: '#374151' })}>{emp.email}</td>
                        <td style={cell({ color: '#6b7280' })}>{emp.phone_number || '—'}</td>
                        <td style={cell({ color: '#6b7280' })}>{emp.department || '—'}</td>
                        <td style={cell({ color: '#6b7280' })}>{emp.position || '—'}</td>
                        <td style={cell({ color: '#6b7280', fontSize: 11, whiteSpace: 'nowrap' })}>{contractLabel(emp.contract_type)}</td>
                        <td style={cell({ textAlign: 'center' })}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 999,
                            background: isActive ? '#d1fae5' : isAnon ? '#fee2e2' : '#f3f4f6',
                            color:      isActive ? '#065f46' : isAnon ? '#991b1b' : '#6b7280',
                          }}>
                            {isActive ? 'Aktywny' : isAnon ? 'Zanonimizowany' : 'Nieaktywny'}
                          </span>
                        </td>
                        <td style={cell({ textAlign: 'center', color: '#9ca3af' })}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={10} style={{ padding: 0, background: '#eff6ff', borderLeft: '3px solid #3b82f6', borderBottom: '2px solid #bfdbfe' }}>
                            <div className="px-5 py-4">
                              {isEditing ? (
                                <div className="bg-white border border-blue-200 rounded-lg p-4 mb-3">
                                  <p className="text-xs font-bold text-blue-700 mb-3">Edytuj dane pracownika</p>
                                  <EditForm
                                    emp={emp}
                                    onSaved={() => { setEditingId(null); onRefresh(); }}
                                    onCancel={() => setEditingId(null)}
                                  />
                                </div>
                              ) : (
                                <div className="grid grid-cols-3 gap-3 mb-3">

                                  {/* Dane kontaktowe */}
                                  <div className="bg-white border border-blue-100 rounded-lg p-3">
                                    <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                      <Mail size={11} /> Kontakt
                                    </p>
                                    <EmpDetailRow label="E-mail"  value={emp.email} />
                                    <EmpDetailRow label="Telefon" value={emp.phone_number} />
                                    <EmpDetailRow label="PESEL"   value={emp.pesel} mono />
                                  </div>

                                  {/* Konto bankowe */}
                                  <div className="bg-white border border-blue-100 rounded-lg p-3">
                                    <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                      <CreditCard size={11} /> Konto bankowe
                                    </p>
                                    <EmpDetailRow label="IBAN"   value={emp.iban} mono />
                                    <EmpDetailRow label="Status" value={
                                      emp.iban
                                        ? (emp.iban_verified ? 'Zweryfikowane ✓' : 'Niezweryfikowane')
                                        : null
                                    } />
                                  </div>

                                  {/* Zatrudnienie */}
                                  <div className="bg-white border border-blue-100 rounded-lg p-3">
                                    <p className="flex items-center gap-1.5 text-xs font-bold text-blue-700 uppercase tracking-wide mb-2.5">
                                      <FileText size={11} /> Zatrudnienie
                                    </p>
                                    <EmpDetailRow label="Typ umowy" value={contractLabel(emp.contract_type)} />
                                    <EmpDetailRow label="Data zatrud." value={formatDate(emp.hire_date)} />
                                    <EmpDetailRow label="ID konta"   value={emp.id} mono small />
                                  </div>
                                </div>
                              )}

                              {/* Action buttons */}
                              <div className="flex items-center gap-2 pt-2.5 border-t border-blue-100">
                                {!isEditing && !isAnon && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setEditingId(emp.id); }}
                                    className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded font-medium transition-colors"
                                  >
                                    <Pencil size={12} /> Edytuj dane
                                  </button>
                                )}
                                {isActive && !isEditing ? (
                                  <button
                                    onClick={e => { e.stopPropagation(); doAction(emp.id, 'deactivate'); }}
                                    disabled={isBusy}
                                    className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-60"
                                  >
                                    <UserX size={12} /> Dezaktywuj pracownika
                                  </button>
                                ) : !isActive && !isAnon && !isEditing ? (
                                  <button
                                    onClick={e => { e.stopPropagation(); doAction(emp.id, 'activate'); }}
                                    disabled={isBusy}
                                    className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-60"
                                  >
                                    <UserCheck size={12} /> Reaktywuj pracownika
                                  </button>
                                ) : null}
                                {!isAnon && !isEditing && (
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      if (confirm(`Czy na pewno anonimizować dane ${emp.full_name ?? emp.email}? Tej operacji nie można cofnąć.`)) {
                                        doAction(emp.id, 'anonymize');
                                      }
                                    }}
                                    disabled={isBusy}
                                    className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-60"
                                  >
                                    <ShieldOff size={12} /> Anonimizacja RODO
                                  </button>
                                )}
                                <button
                                  onClick={e => { e.stopPropagation(); setExpandedId(null); setEditingId(null); }}
                                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded hover:bg-gray-100 transition-colors"
                                >
                                  <ChevronUp size={12} /> Zwiń
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
