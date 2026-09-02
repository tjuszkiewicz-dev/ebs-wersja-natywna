'use client';

import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { OrgUser } from './OrgChart';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  allUsers: OrgUser[];
}

const ROLES = [
  { value: 'dyrektor',   label: 'Dyrektor' },
  { value: 'menedzer',   label: 'Menedżer' },
  { value: 'partner',    label: 'Partner' },
  { value: 'hr',         label: 'HR / Księgowość' },
  { value: 'pracodawca', label: 'Pracodawca' },
] as const;

export const OrgAddMemberModal: React.FC<Props> = ({ isOpen, onClose, onCreated, allUsers }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('menedzer');
  const [managerId, setManagerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setFullName('');
    setEmail('');
    setRole('menedzer');
    setManagerId(null);
    setError(null);
    setCreated(null);
    setCopied(false);
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch('/api/org/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          role,
          manager_id: managerId,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(typeof body.error === 'string' ? body.error : 'Błąd tworzenia');
      }
      setCreated({ email: body.email, tempPassword: body.tempPassword });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd');
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(`${created.email}\n${created.tempPassword}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 z-[60] flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg">Dodaj członka struktury</h3>
          <button
            onClick={handleClose}
            disabled={saving}
            className="p-1 rounded hover:bg-slate-100 transition-colors disabled:opacity-50"
            aria-label="Zamknij"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        {created ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-green-800 mb-2">
                Konto utworzone — przekaż dane logowania:
              </p>
              <div className="space-y-1 text-sm font-mono bg-white border border-green-200 rounded p-3">
                <div><span className="text-slate-500">Email:</span> {created.email}</div>
                <div><span className="text-slate-500">Hasło:</span> {created.tempPassword}</div>
              </div>
            </div>
            <button
              onClick={copyCredentials}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Skopiowano' : 'Kopiuj dane'}
            </button>
            <button
              onClick={handleClose}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#4a95a9] hover:opacity-90"
            >
              Gotowe
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Imię i nazwisko *
              </label>
              <input
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                placeholder="Jan Kowalski"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4a95a9]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="jan@firma.pl"
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4a95a9]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Rola *
              </label>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4a95a9] bg-white"
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                Przełożony
              </label>
              <select
                value={managerId ?? ''}
                onChange={e => setManagerId(e.target.value === '' ? null : e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4a95a9] bg-white"
              >
                <option value="">— brak (korzeń drzewa) —</option>
                {allUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-[#4a95a9] hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Tworzę…' : 'Utwórz konto'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
