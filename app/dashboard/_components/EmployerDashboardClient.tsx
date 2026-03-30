'use client';

import React, { useState } from 'react';
import { DashboardBootstrap } from './DashboardBootstrap';
import { DashboardHR } from '@/views/DashboardHR';
import { useStrattonSystem } from '@/context/StrattonContext';
import { Role } from '@/types';

function EmployerContent() {
  const { state, actions } = useStrattonSystem();
  const [currentView, setCurrentView] = useState('START');

  const { users, companies, orders, vouchers, importHistory } = state;
  const currentUser = state.currentUser;

  if (!currentUser) return null;

  const company = companies.find(c => c.id === currentUser.companyId)
    ?? companies[0];

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        Brak przypisanej firmy. Skontaktuj się z administratorem.
      </div>
    );
  }

  const myEmployees = users.filter(
    u => u.companyId === company.id && u.role === Role.EMPLOYEE
  );
  const myOrders   = orders.filter(o => o.companyId === company.id);
  const myVouchers = vouchers.filter(v => v.companyId === company.id);

  return (
    <DashboardHR
      currentView={currentView}
      onViewChange={setCurrentView}
      company={company}
      employees={myEmployees}
      orders={myOrders}
      vouchers={myVouchers}
      importHistory={importHistory}
      onPlaceOrder={actions.handlePlaceOrder}
      onDistribute={actions.handleDistribute}
      onPayOrder={() => actions.addToast('Integracja Bankowa', 'Funkcja dostępna w pełnej wersji.', 'INFO')}
      onDeactivateEmployee={actions.handleDeactivateEmployee}
      onViewProforma={() => {}}
      onBulkImport={actions.handleBulkImport}
      onParsePayroll={actions.handleParseAndMatchPayroll}
      onExportPayrollTemplate={actions.handleExportPayrollTemplate}
    />
  );
}

export function EmployerDashboardClient() {
  return (
    <DashboardBootstrap>
      <EmployerContent />
    </DashboardBootstrap>
  );
}
