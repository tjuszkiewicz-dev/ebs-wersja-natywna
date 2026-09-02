'use client';

import React from 'react';
import { DashboardBootstrap } from './DashboardBootstrap';
import { DashboardSales } from '@/views/DashboardSales';
import { useStrattonSystem } from '@/context/StrattonContext';
import { Role } from '@/types';
// E7d: partner widzi własną pozycję w rankingu (nie cudze wyniki — tak liczy API).
import { PartnerLeaderboardWidget } from '@/components/crm/sales/PartnerLeaderboardWidget';

function NetworkContent() {
  const { state } = useStrattonSystem();
  const { commissions, companies, orders, users } = state;
  const currentUser = state.currentUser;

  if (!currentUser) return null;

  return (
    <>
      {currentUser.role === Role.ADVISOR && (
        <div className="mb-6">
          <PartnerLeaderboardWidget />
        </div>
      )}
      <DashboardSales
        currentUser={currentUser}
        commissions={commissions}
        companies={companies}
        orders={orders}
        allUsers={users}
      />
    </>
  );
}

export function NetworkDashboardClient() {
  return (
    <DashboardBootstrap>
      <NetworkContent />
    </DashboardBootstrap>
  );
}
