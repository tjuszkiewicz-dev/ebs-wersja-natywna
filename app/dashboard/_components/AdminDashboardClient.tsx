'use client';

import React, { useState } from 'react';
import { DashboardBootstrap } from './DashboardBootstrap';
import { DashboardSuperadmin } from '@/views/DashboardSuperadmin';
import { useStrattonSystem } from '@/context/StrattonContext';

function AdminContent() {
  const { state, actions } = useStrattonSystem();
  const [currentView, setCurrentView] = useState('OVERVIEW');

  const {
    orders, vouchers, users, companies, buybacks, auditLogs,
    commissions, notificationConfigs, services, systemConfig,
  } = state;

  return (
    <DashboardSuperadmin
      currentView={currentView}
      orders={orders}
      vouchers={vouchers}
      users={users}
      companies={companies}
      buybacks={buybacks}
      auditLogs={auditLogs}
      commissions={commissions}
      notificationConfigs={notificationConfigs}
      services={services}
      systemConfig={systemConfig}
      onApproveOrder={actions.handleApproveOrder}
      onSimulateBankPayment={actions.handleBankPayment}
      onApproveBuyback={actions.handleApproveBuyback}
      onSimulateExpiration={actions.simulateExpiration}
      onViewDocument={(_type, _data) => {}}
      onUpdateNotificationConfig={actions.handleUpdateNotificationConfig}
      onUpdateSystemConfig={actions.handleUpdateSystemConfig}
      onUpdateCompanyConfig={actions.handleUpdateCompanyConfig}
      onManualEmission={actions.handleManualEmission}
    />
  );
}

export function AdminDashboardClient() {
  return (
    <DashboardBootstrap>
      <AdminContent />
    </DashboardBootstrap>
  );
}
