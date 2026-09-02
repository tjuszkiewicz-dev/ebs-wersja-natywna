'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { OrgUser } from './OrgChart';

interface OrgNodeEditorProps {
  user: OrgUser | null;
  allUsers: OrgUser[];
  onClose: () => void;
  onSave: (
    id: string,
    updates: { full_name?: string; role?: string; manager_id?: string | null }
  ) => Promise<void>;
  onRefresh: () => void;
}

const ROLES = [
  'superadmin',
  'dyrektor',
  'menedzer',
  'partner',
  'hr',
  'pracownik',
  'pracodawca',
] as const;

export const OrgNodeEditor: React.FC<OrgNodeEditorProps> = ({
  user,
  allUsers,
  onClose,
  onSave,
  onRefresh,
}) => {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [managerId, setManagerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name);
      setRole(user.role);
      setManagerId(user.manager_id);
      setToast(null);
    }
  }, [user]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await onSave(user.id, { full_name: fullName, role, manager_id: managerId });
      showToast('success', 'Zapisano pomyślnie');
      onRefresh();
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFromTree = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await onSave(user.id, { manager_id: null });
      showToast('success', 'Usunięto z drzewa');
      onRefresh();
    } catch (e: unknown) {
      showToast('error', e instanceof Error ? e.message : 'Błąd');
    } finally {
      setSaving(false);
    }
  };

  const isVisible = user !== null;

  return (
    <div
      className={`fixed right-0 top-0 h-full w-80 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${
        isVisible ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="bg-slate-800 text-white p-4 flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <span className="font-semibold text-sm leading-tight">
            {user?.full_name ?? ''}
          </span>
          <span className="text-slate-400 text-xs mt-0.5">{user?.role ?? ''}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-700 transition-colors"
          aria-label="Zamknij"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Form */}
      <div className="p-4 space-y-4 flex-1 overflow-y-auto">
        {/* Full name */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Imię i nazwisko
          </label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Imię i nazwisko"
          />
        </div>

        {/* Role */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Rola
          </label>
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {ROLES.map(r => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* Manager */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">
            Przełożony
          </label>
          <select
            value={managerId ?? ''}
            onChange={e => setManagerId(e.target.value === '' ? null : e.target.value)}
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">Brak</option>
            {allUsers
              .filter(u => u.id !== user?.id)
              .map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.role})
                </option>
              ))}
          </select>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`rounded-lg px-3 py-2 text-sm ${
              toast.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 space-y-2 border-t border-slate-100 shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Zapisywanie...' : 'Zapisz'}
        </button>
        <button
          onClick={handleRemoveFromTree}
          disabled={saving}
          className="w-full border border-gray-300 text-gray-600 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Usuń z drzewa
        </button>
      </div>
    </div>
  );
};
