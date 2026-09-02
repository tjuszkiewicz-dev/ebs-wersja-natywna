'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { OrgChart } from './OrgChart';
import { OrgNodeEditor } from './OrgNodeEditor';
import { OrgAddMemberModal } from './OrgAddMemberModal';
import type { OrgUser } from './OrgChart';

export const OrgChartView: React.FC = () => {
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null);
  const [allUsers, setAllUsers] = useState<OrgUser[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);

  const fetchAllUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/org/users');
      if (!res.ok) return;
      const data: OrgUser[] = await res.json();
      setAllUsers(data);
    } catch {
      // OrgChart shows its own error state
    }
  }, []);

  useEffect(() => {
    fetchAllUsers();
  }, [fetchAllUsers, refreshKey]);

  const handleNodeClick = (user: OrgUser) => {
    setSelectedUser(prev => (prev?.id === user.id ? null : user));
  };

  const handleClose = () => setSelectedUser(null);

  const handleSave = async (
    id: string,
    updates: { full_name?: string; role?: string; manager_id?: string | null }
  ) => {
    const res = await fetch(`/api/org/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
  };

  const handleRefresh = () => setRefreshKey(k => k + 1);

  const handleNodeDrop = async (nodeId: string, newManagerId: string) => {
    try {
      await handleSave(nodeId, { manager_id: newManagerId });
      handleRefresh();
    } catch {
      // user can fix via editor panel
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-7rem)] flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-base font-bold text-slate-800">Struktura organizacyjna</h1>
          <p className="text-xs text-slate-500">
            Kliknij węzeł aby edytować • przeciągnij aby zmienić przełożonego
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50"
            title="Odśwież"
          >
            <RefreshCw size={14} className="text-slate-500" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#4a95a9] hover:opacity-90"
          >
            <Plus size={16} />
            Dodaj członka
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 relative">
        <OrgChart
          onNodeClick={handleNodeClick}
          selectedNodeId={selectedUser?.id ?? null}
          refreshKey={refreshKey}
          onNodeDrop={handleNodeDrop}
        />
      </div>

      <OrgNodeEditor
        user={selectedUser}
        allUsers={allUsers}
        onClose={handleClose}
        onSave={handleSave}
        onRefresh={handleRefresh}
      />

      <OrgAddMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={handleRefresh}
        allUsers={allUsers}
      />
    </div>
  );
};
