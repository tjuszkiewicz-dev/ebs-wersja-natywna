'use client';

import React from 'react';
import { DashboardBootstrap } from './DashboardBootstrap';
import { DashboardSales } from '@/views/DashboardSales';
import { useStrattonSystem } from '@/context/StrattonContext';

function NetworkContent() {
  const { state } = useStrattonSystem();
  const { commissions, companies, orders, users } = state;
  const currentUser = state.currentUser;

  if (!currentUser) return null;

  return (
    <DashboardSales
      currentUser={currentUser}
      commissions={commissions}
      companies={companies}
      orders={orders}
      allUsers={users}
    />
  );
}

export function NetworkDashboardClient() {
  return (
    <DashboardBootstrap>
      <NetworkContent />
    </DashboardBootstrap>
  );
}
