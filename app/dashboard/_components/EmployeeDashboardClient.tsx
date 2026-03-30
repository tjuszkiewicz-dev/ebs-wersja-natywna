'use client';

import React, { useState } from 'react';
import { DashboardBootstrap } from './DashboardBootstrap';
import { DashboardEmployee } from '@/views/DashboardEmployee';
import { useStrattonSystem } from '@/context/StrattonContext';

function EmployeeContent() {
  const { state, actions } = useStrattonSystem();
  const [currentView, setCurrentView] = useState('WALLET');

  const { vouchers, buybacks, services, transactions } = state;
  const currentUser = state.currentUser;

  if (!currentUser) return null;

  const myVouchers     = vouchers.filter(v => v.ownerId === currentUser.id);
  const myBuybacks     = buybacks.filter(b => b.userId === currentUser.id);
  const myTransactions = transactions.filter(t => t.userId === currentUser.id);

  return (
    <DashboardEmployee
      currentView={currentView}
      user={currentUser}
      vouchers={myVouchers}
      buybacks={myBuybacks}
      services={services}
      transactions={myTransactions}
      onViewChange={setCurrentView}
      onPurchaseService={actions.handleServicePurchase}
      onViewAgreement={() => {}}
    />
  );
}

export function EmployeeDashboardClient() {
  return (
    <DashboardBootstrap>
      <EmployeeContent />
    </DashboardBootstrap>
  );
}
