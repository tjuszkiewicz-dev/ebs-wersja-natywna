'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X, Phone, Mail, Edit2, Trash2, RefreshCw, User, AlertCircle } from 'lucide-react';

interface Contact {
  id:           string;
  first_name:   string;
  last_name:    string;
  email?:       string;
  phone?:       string;
  position?:    string;
  company_name?: string;
  notes?:       string;
  is_primary:   boolean;
  created_at:   string;
}

const EMPTY_FORM = {
  first_name: '', last_name: '', email: '', phone: '',
  position: '', company_name: '', notes: '', is_primary: false,
};

export const CrmKontakty: React.FC = () => {
  const [contacts, setContacts]   = useState<Contact[]>([]);
  const [loading,  setLoading]    = useState(true);
  const [error,    setError]      = useState<string | null>(null);
  const [search,   setSearch]     = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [editing,  setEditing]    = useState<Contact | null>(null);
  const [form,     setForm]       = useState(EMPTY_FORM);
  const [saving,   setSaving]     = useState(false);

  const fetchContacts = useCallback(async (q?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = q ? `/api/crm/contacts?q=${encodeURIComponent(q)}` : '/api/crm/contacts';
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setContacts(await res.json());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleSearch = (q: string) => {
    setSearch(q);
    if (q.length >= 2 || q.length === 0) fetchContacts(q);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (c: Contact) => {
    setEditing(c);
    setForm({
      first_name: c.first_name, last_name: c.last_name,
      email: c.email ?? '', phone: c.phone ?? '',
      position: c.position ?? '', company_name: c.company_name ?? '',
      notes: c.notes ?? '', is_primary: c.is_primary,
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const url    = editing ? `/api/crm/contacts/${editing.id}` : '/api/crm/contacts';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Błąd zapisu');
      setShowForm(false);
      await fetchContacts(search || undefined);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Usunąć kontakt: ${name}?`)) return;
    await fetch(`/api/crm/contacts/${id}`, { method: 'DELETE' });
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const initials = (c: Contact) =>
    `${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`.toUpperCase();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Kontakty CRM</h2>
          <p className="text-xs text-slate-500">{contacts.length} kontaktów</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:flex-none">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Szukaj..."
              className="pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-full sm:w-52"
            />
          </div>
          <button onClick={() => fetchContacts(search || undefined)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#f0a500' }}
          >
            <Plus size={16} /> Dodaj
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Osoba</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Firma / Stanowisko</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kontakt</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">Ładowanie...</td></tr>
            )}
            {!loading && contacts.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">Brak kontaktów</td></tr>
            )}
            {contacts.map(c => (
              <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: '#4a95a9' }}
                    >
                      {initials(c)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">{c.first_name} {c.last_name}</p>
                      {c.is_primary && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Główny</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {c.company_name && <p className="font-medium text-slate-700 text-xs">{c.company_name}</p>}
                  {c.position && <p className="text-slate-400 text-xs">{c.position}</p>}
                </td>
                <td className="px-4 py-3 space-y-0.5">
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                      <Mail size={12} /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-xs text-slate-600 hover:underline">
                      <Phone size={12} /> {c.phone}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(c)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(c.id, `${c.first_name} ${c.last_name}`)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="sm:hidden space-y-2">
        {loading && <p className="text-center text-slate-400 py-6 text-sm">Ładowanie...</p>}
        {!loading && contacts.length === 0 && <p className="text-center text-slate-400 py-6 text-sm">Brak kontaktów</p>}
        {contacts.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                  style={{ backgroundColor: '#4a95a9' }}
                >
                  {initials(c)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{c.first_name} {c.last_name}</p>
                  {c.company_name && <p className="text-xs text-slate-500">{c.company_name}</p>}
                  {c.position && <p className="text-xs text-slate-400">{c.position}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => handleDelete(c.id, `${c.first_name} ${c.last_name}`)} className="p-1.5 rounded hover:bg-red-50 text-red-400">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.phone && (
                <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-blue-600">
                  <Phone size={11} /> {c.phone}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-blue-600">
                  <Mail size={11} /> {c.email}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <User size={16} style={{ color: '#4a95a9' }} />
                {editing ? 'Edytuj kontakt' : 'Nowy kontakt'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'first_name', label: 'Imię *',    req: true },
                  { key: 'last_name',  label: 'Nazwisko *', req: true },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={(form as any)[f.key]}
                      required={f.req}
                      onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                ))}
              </div>
              {[
                { key: 'email',        label: 'Email',            type: 'email' },
                { key: 'phone',        label: 'Telefon',          type: 'text' },
                { key: 'position',     label: 'Stanowisko',       type: 'text' },
                { key: 'company_name', label: 'Nazwa firmy',      type: 'text' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Notatki</label>
                <textarea
                  value={form.notes}
                  rows={2}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_primary}
                  onChange={e => setForm(prev => ({ ...prev, is_primary: e.target.checked }))}
                  className="rounded"
                />
                Główny kontakt w firmie
              </label>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-60"
                  style={{ backgroundColor: '#4a95a9' }}
                >
                  {saving ? 'Zapisuję...' : editing ? 'Zapisz' : 'Dodaj'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
