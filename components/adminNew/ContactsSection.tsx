import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, User, Phone, Mail, Check, X, Loader2, AlertCircle, UserPlus, ShieldCheck, ChevronDown, ChevronUp, Eye, EyeOff, Copy, RefreshCw } from 'lucide-react';

// ── Typy ────────────────────────────────────────────────────────────────────

export interface Contact {
  id:                string;
  company_id:        string;
  first_name:        string;
  last_name:         string;
  phone:             string | null;
  email:             string | null;
  is_decision_maker: boolean;
  is_hr_operator:    boolean;
  created_at:        string;
}

interface Props {
  companyId:      string;
  onCountChange?: (n: number) => void;
}

const EMPTY_FORM = {
  first_name:        '',
  last_name:         '',
  phone:             '',
  email:             '',
  is_decision_maker: false,
  is_hr_operator:    false,
};

// ── Contact Row (inline edit) ─────────────────────────────────────────────────

const ContactForm: React.FC<{
  initial:  typeof EMPTY_FORM;
  onSave:   (data: typeof EMPTY_FORM) => Promise<void>;
  onCancel: () => void;
  saving:   boolean;
}> = ({ initial, onSave, onCancel, saving }) => {
  const [form, setForm] = useState(initial);
  const set = (key: string, value: any) => setForm((p) => ({ ...p, [key]: value }));

  // E-mail wymagany gdy kontakt jest Operatorem HR
  const emailMissing = form.is_hr_operator && !form.email.trim();
  const canSave = form.first_name.trim() && form.last_name.trim() && !emailMissing;

  return (
    <div className="p-4 bg-blue-50 rounded-xl border border-blue-200 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          value={form.first_name}
          onChange={(e) => set('first_name', e.target.value)}
          placeholder="Imię *"
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          value={form.last_name}
          onChange={(e) => set('last_name', e.target.value)}
          placeholder="Nazwisko *"
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <input
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
          placeholder="Telefon"
          className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div>
          <input
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder={form.is_hr_operator ? 'E-mail (wymagany) *' : 'E-mail'}
            type="email"
            className={`w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              emailMissing ? 'border-red-400 bg-red-50' : 'border-slate-200'
            }`}
          />
          {emailMissing && (
            <p className="text-[11px] text-red-500 mt-0.5">E-mail wymagany dla Operatora HR</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_decision_maker}
            onChange={(e) => set('is_decision_maker', e.target.checked)}
            className="w-4 h-4 rounded accent-blue-600"
          />
          Decyzyjna
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold text-blue-700 cursor-pointer">
          <input
            type="checkbox"
            checked={form.is_hr_operator}
            onChange={(e) => set('is_hr_operator', e.target.checked)}
            className="w-4 h-4 rounded accent-blue-600"
          />
          Operator HR
          <span className="text-[10px] font-normal text-blue-500">(zakładany jako konto HR)</span>
        </label>
      </div>
      {form.is_hr_operator && (
        <div className="flex items-start gap-2 p-2.5 bg-blue-100 border border-blue-200 rounded-lg text-blue-800 text-xs">
          <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
          Ten kontakt otrzyma dostęp do panelu HR firmy. Po zapisaniu użyj przycisku
          &nbsp;<strong>Utwórz konto HR</strong>, aby założyć konto w systemie.
        </div>
      )}
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-100 transition"
        >
          Anuluj
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={saving || !canSave}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition disabled:opacity-60"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Zapisz
        </button>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

export const ContactsSection: React.FC<Props> = ({ companyId, onCountChange }) => {
  const [contacts,  setContacts]  = useState<Contact[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [adding,    setAdding]    = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);
  // Tworzenie konta HR
  const [hrCreating,  setHrCreating]  = useState<string | null>(null);
  const [hrResults,   setHrResults]   = useState<Record<string, string>>({});
  const [hrExists,    setHrExists]    = useState<Set<string>>(new Set());
  const [hrPasswords, setHrPasswords] = useState<Record<string, string>>({});
  const [expandedId,  setExpandedId]  = useState<string | null>(null);
  const [pwVisible,   setPwVisible]   = useState<Set<string>>(new Set());
  const [resetting,   setResetting]   = useState<string | null>(null);
  const [customPw,    setCustomPw]    = useState<Record<string, string>>({});
  const [customSaving, setCustomSaving] = useState<string | null>(null);
  const [customError,  setCustomError]  = useState<Record<string, string>>({});

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Contact[] = await res.json();
      setContacts(data);
      onCountChange?.(data.length);
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania');
      onCountChange?.(0);
    } finally {
      setLoading(false);
    }
  }, [companyId, onCountChange]);

  const fetchHrExists = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts/hr-accounts`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.existingAccounts)) {
        setHrExists(new Set<string>(data.existingAccounts));
      }
      if (data.passwords && typeof data.passwords === 'object') {
        setHrPasswords((prev) => ({ ...data.passwords, ...prev }));
      }
    } catch { /* ignore — button stays active if check fails */ }
  }, [companyId]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);
  useEffect(() => { fetchHrExists(); }, [fetchHrExists]);

  const handleAdd = async (data: typeof EMPTY_FORM) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...data,
          email: data.email || null,
          phone: data.phone || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Błąd');
      setAdding(false);
      fetchContacts();
    } catch (e: any) {
      alert(e.message ?? 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (contactId: string, data: typeof EMPTY_FORM) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/companies/${companyId}/contacts/${contactId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...data,
          email: data.email || null,
          phone: data.phone || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Błąd');
      setEditingId(null);
      fetchContacts();
    } catch (e: any) {
      alert(e.message ?? 'Błąd');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contactId: string, name: string) => {
    if (!confirm(`Usunąć kontakt: ${name}?`)) return;
    try {
      await fetch(`/api/companies/${companyId}/contacts/${contactId}`, { method: 'DELETE' });
      fetchContacts();
    } catch { /* ignore */ }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text).catch(() => {}); };

  const handleResetPassword = async (contact: Contact, customPassword?: string) => {
    if (customPassword !== undefined) {
      if (customPassword.length < 8) {
        setCustomError((prev) => ({ ...prev, [contact.id]: 'Hasło musi mieć co najmniej 8 znaków' }));
        return;
      }
      setCustomError((prev) => ({ ...prev, [contact.id]: '' }));
      setCustomSaving(contact.id);
    } else {
      setResetting(contact.id);
    }
    try {
      const res  = await fetch(`/api/companies/${companyId}/contacts/${contact.id}/reset-hr-password`, {
        method: 'POST',
        headers: customPassword !== undefined ? { 'Content-Type': 'application/json' } : {},
        body:    customPassword !== undefined ? JSON.stringify({ password: customPassword }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setHrPasswords((prev) => ({ ...prev, [contact.id]: data.tempPassword }));
      setPwVisible((prev) => { const next = new Set(prev); next.add(contact.id); return next; });
      if (customPassword !== undefined) setCustomPw((prev) => ({ ...prev, [contact.id]: '' }));
    } catch (e: any) {
      if (customPassword !== undefined) {
        setCustomError((prev) => ({ ...prev, [contact.id]: e.message ?? 'Błąd' }));
      } else {
        alert(`Błąd resetowania hasła: ${e.message ?? 'Nieznany błąd'}`);
      }
    } finally {
      setResetting(null);
      setCustomSaving(null);
    }
  };

  const handleCreateHrAccount = async (contact: Contact) => {
    if (!contact.email) return;
    setHrCreating(contact.id);
    try {
      const res  = await fetch(`/api/companies/${companyId}/contacts/${contact.id}/create-hr-account`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.status === 409) {
        // Konto już istnieje — traktuj jako sukces, zaznacz w hrExists i rozwiń panel
        setHrExists((prev) => { const next = new Set(prev); next.add(contact.id); return next; });
        setExpandedId(contact.id);
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setHrResults((prev) => ({ ...prev, [contact.id]: data.tempPassword ?? 'ok' }));
      setHrExists((prev) => { const next = new Set(prev); next.add(contact.id); return next; });
      if (data.tempPassword) {
        setHrPasswords((prev) => ({ ...prev, [contact.id]: data.tempPassword }));
        setPwVisible((prev) => { const next = new Set(prev); next.add(contact.id); return next; });
        setExpandedId(contact.id);
      }
    } catch (e: any) {
      setHrResults((prev) => ({ ...prev, [contact.id]: `ERR:${e.message ?? 'Błąd'}` }));
    } finally {
      setHrCreating(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-700">Osoby do kontaktu</span>
        <button
          onClick={() => { setAdding(true); setEditingId(null); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
        >
          <Plus size={12} />
          Dodaj kontakt
        </button>
      </div>

      <div className="p-4 space-y-3">
        {loading && (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin text-slate-300" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-xl">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {adding && (
          <ContactForm
            initial={EMPTY_FORM}
            onSave={handleAdd}
            onCancel={() => setAdding(false)}
            saving={saving}
          />
        )}

        {!loading && contacts.length === 0 && !adding && (
          <p className="text-center text-slate-400 text-sm py-4">Brak osób do kontaktu</p>
        )}

        {contacts.map((c) => {
          const accountExists =
            hrExists.has(c.id) ||
            (!!hrResults[c.id] && !hrResults[c.id].startsWith('ERR:')) ||
            !!hrPasswords[c.id];
          const knownPw =
            hrPasswords[c.id] ??
            (hrResults[c.id] && !hrResults[c.id].startsWith('ERR:') ? hrResults[c.id] : null);
          const isExpanded   = expandedId === c.id;
          const isExpandable = c.is_hr_operator && accountExists;

          return editingId === c.id ? (
            <ContactForm
              key={c.id}
              initial={{
                first_name:        c.first_name,
                last_name:         c.last_name,
                phone:             c.phone ?? '',
                email:             c.email ?? '',
                is_decision_maker: c.is_decision_maker,
                is_hr_operator:    c.is_hr_operator,
              }}
              onSave={(data) => handleEdit(c.id, data)}
              onCancel={() => setEditingId(null)}
              saving={saving}
            />
          ) : (
            <div
              key={c.id}
              className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden"
            >
              {/* ── Główny wiersz ── */}
              <div
                className={`flex items-start gap-3 p-3 transition-colors ${
                  isExpandable ? 'cursor-pointer hover:bg-slate-100/80' : ''
                }`}
                onClick={() => isExpandable && setExpandedId(isExpanded ? null : c.id)}
              >
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User size={14} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {c.first_name} {c.last_name}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    {c.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone size={10} />{c.phone}
                      </span>
                    )}
                    {c.email && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Mail size={10} />{c.email}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {c.is_decision_maker && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold">
                        Decyzyjna
                      </span>
                    )}
                    {c.is_hr_operator && (
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold flex items-center gap-0.5">
                        <ShieldCheck size={9} />
                        Operator HR
                      </span>
                    )}
                  </div>
                  {hrResults[c.id]?.startsWith('ERR:') && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
                      {hrResults[c.id].replace('ERR:', '')}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {c.is_hr_operator && c.email && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!accountExists) handleCreateHrAccount(c);
                          else setExpandedId(isExpanded ? null : c.id);
                        }}
                        disabled={hrCreating === c.id}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                          accountExists
                            ? 'bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100'
                            : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60'
                        }`}
                        title={accountExists ? 'Konto HR aktywne — kliknij, aby zobaczyć szczegóły' : 'Utwórz konto HR dla tej osoby'}
                      >
                        {hrCreating === c.id
                          ? <Loader2 size={11} className="animate-spin" />
                          : accountExists
                            ? <ShieldCheck size={11} />
                            : <UserPlus size={11} />
                        }
                        {accountExists ? 'Konto HR aktywne' : 'Utwórz konto HR'}
                      </button>
                      {isExpandable && (
                        isExpanded
                          ? <ChevronUp size={13} className="text-slate-400" />
                          : <ChevronDown size={13} className="text-slate-400" />
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingId(c.id); setAdding(false); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700 transition"
                      title="Edytuj"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(c.id, `${c.first_name} ${c.last_name}`); }}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition"
                      title="Usuń"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>

              {/* ── Panel konta HR ── */}
              {isExpanded && c.is_hr_operator && (
                <div className="px-4 py-3 border-t border-blue-100 bg-blue-50/60">
                  <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-3">Dane konta HR</p>

                  {/* Login */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-slate-500 w-12 shrink-0">Login</span>
                    <span className="text-xs font-mono text-slate-700 flex-1 truncate">{c.email}</span>
                    <button
                      onClick={() => copyToClipboard(c.email!)}
                      className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition"
                      title="Kopiuj login"
                    >
                      <Copy size={11} />
                    </button>
                  </div>

                  {/* Hasło */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[11px] text-slate-500 w-12 shrink-0">Hasło</span>
                    {knownPw ? (
                      <>
                        <span className="text-xs text-slate-700 flex-1 select-all tracking-wide" style={{ fontFamily: "'Courier New', Courier, monospace", letterSpacing: '0.05em' }}>
                          {pwVisible.has(c.id) ? knownPw : '••••••••••'}
                        </span>
                        <button
                          onClick={() => setPwVisible((prev) => {
                            const next = new Set(prev);
                            next.has(c.id) ? next.delete(c.id) : next.add(c.id);
                            return next;
                          })}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition"
                          title={pwVisible.has(c.id) ? 'Ukryj hasło' : 'Pokaż hasło'}
                        >
                          {pwVisible.has(c.id) ? <EyeOff size={11} /> : <Eye size={11} />}
                        </button>
                        <button
                          onClick={() => copyToClipboard(knownPw)}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition"
                          title="Kopiuj hasło"
                        >
                          <Copy size={11} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic flex-1">
                        Nieznane — zresetuj, aby ustawić nowe hasło
                      </span>
                    )}
                  </div>

                  {/* Zresetuj hasło */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-blue-100">
                    {/* Ręczne hasło */}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customPw[c.id] ?? ''}
                        onChange={(e) => {
                          setCustomPw((prev) => ({ ...prev, [c.id]: e.target.value }));
                          setCustomError((prev) => ({ ...prev, [c.id]: '' }));
                        }}
                        placeholder="Nowe hasło (min. 8 znaków)"
                        className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 font-mono"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && customPw[c.id]?.length >= 8)
                            handleResetPassword(c, customPw[c.id]);
                        }}
                      />
                      <button
                        onClick={() => handleResetPassword(c, customPw[c.id] ?? '')}
                        disabled={customSaving === c.id || !customPw[c.id]}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                        title="Ustaw podane hasło"
                      >
                        {customSaving === c.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                        Ustaw
                      </button>
                    </div>
                    {customError[c.id] && (
                      <p className="text-[10px] text-red-500">{customError[c.id]}</p>
                    )}

                    {/* Generuj losowe */}
                    <button
                      onClick={() => handleResetPassword(c)}
                      disabled={resetting === c.id}
                      className="self-start flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition disabled:opacity-60"
                    >
                      {resetting === c.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <RefreshCw size={11} />
                      }
                      Generuj losowe hasło
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
