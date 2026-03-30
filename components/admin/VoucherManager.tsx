
import React, { useState, useMemo } from 'react';
import { Voucher, VoucherStatus } from '../../types';
import { DataTable, Column } from '../ui/DataTable';
import { Badge } from '../ui/Badge';
import { Layers, List } from 'lucide-react';
import { Tabs } from '../ui/Tabs';
import { StatusBadge } from '../ui/StatusBadge';

interface Props {
  vouchers: Voucher[];
}

// Typ pomocniczy dla zagregowanej emisji
interface EmissionGroup {
    id: string;
    emissionId: string;
    companyId: string;
    date: string;
    totalCount: number;
    activeCount: number; // Active + Reserved + Distributed
    usedCount: number;   // Consumed
    expiredCount: number; // Expired + Buyback
    statusDistribution: Record<VoucherStatus, number>;
}

export const VoucherManager: React.FC<Props> = ({ vouchers }) => {
  const [viewMode, setViewMode] = useState<'EMISSIONS' | 'LIST'>('EMISSIONS');

  // --- LOGIKA AGREGACJI (EMISJE) ---
  const emissionsData = useMemo(() => {
      const groups: Record<string, EmissionGroup> = {};

      vouchers.forEach(v => {
          const key = v.emissionId || 'MANUAL-POOL'; // Fallback dla starych danych
          
          if (!groups[key]) {
              groups[key] = {
                  id: key,
                  emissionId: key,
                  companyId: v.companyId,
                  date: v.issueDate,
                  totalCount: 0,
                  activeCount: 0,
                  usedCount: 0,
                  expiredCount: 0,
                  statusDistribution: {
                      [VoucherStatus.CREATED]: 0,
                      [VoucherStatus.RESERVED]: 0,
                      [VoucherStatus.ACTIVE]: 0,
                      [VoucherStatus.DISTRIBUTED]: 0,
                      [VoucherStatus.CONSUMED]: 0,
                      [VoucherStatus.EXPIRED]: 0,
                      [VoucherStatus.BUYBACK_PENDING]: 0,
                      [VoucherStatus.BUYBACK_COMPLETE]: 0,
                  }
              };
          }

          const g = groups[key];
          g.totalCount++;
          g.statusDistribution[v.status]++;

          if (v.status === VoucherStatus.CONSUMED) {
              g.usedCount++;
          } else if (v.status === VoucherStatus.EXPIRED || v.status === VoucherStatus.BUYBACK_PENDING || v.status === VoucherStatus.BUYBACK_COMPLETE) {
              g.expiredCount++;
          } else {
              // Reszta to "W obiegu" (Active, Reserved, Distributed)
              g.activeCount++;
          }
      });

      // Sortowanie: Najnowsze emisje na górze
      return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [vouchers]);

  // --- KOLUMNY DLA WIDOKU EMISJI (ZBIORCZY) ---
  const emissionColumns: Column<EmissionGroup>[] = [
      {
          header: 'ID Emisji / Partii',
          accessorKey: 'emissionId',
          sortable: true,
          cell: (e) => (
              <div className="flex flex-col">
                  <span className="font-mono text-xs font-bold text-slate-700">{e.emissionId}</span>
                  <span className="text-[10px] text-slate-400">{new Date(e.date).toLocaleDateString()}</span>
              </div>
          )
      },
      {
          header: 'Firma',
          accessorKey: 'companyId',
          sortable: true,
          cell: (e) => <span className="font-bold text-slate-800 text-xs">{e.companyId}</span>
      },
      {
          header: 'Utylizacja Puli',
          cell: (e) => {
              const activePct = (e.activeCount / e.totalCount) * 100;
              const usedPct = (e.usedCount / e.totalCount) * 100;
              const expiredPct = (e.expiredCount / e.totalCount) * 100;
              
              return (
                  <div className="w-full max-w-[180px]">
                      <div className="flex justify-between text-[9px] text-slate-500 mb-1 font-mono uppercase tracking-tight">
                          <span>Obieg: {e.activeCount}</span>
                          <span>Zużyte: {e.usedCount}</span>
                      </div>
                      <div className="flex h-2.5 w-full rounded-full overflow-hidden bg-slate-100 border border-slate-200">
                          <div style={{ width: `${usedPct}%` }} className="bg-blue-500" title="Zużyte (Skonsumowane)"></div>
                          <div style={{ width: `${activePct}%` }} className="bg-emerald-500" title="W obiegu (Aktywne/Rozdane)"></div>
                          <div style={{ width: `${expiredPct}%` }} className="bg-amber-400" title="Wygasłe/Odkup"></div>
                      </div>
                  </div>
              );
          }
      },
      {
          header: 'Wolumen',
          accessorKey: 'totalCount',
          sortable: true,
          className: 'text-right',
          cell: (e) => <span className="font-bold text-slate-800">{e.totalCount} szt.</span>
      },
      {
          header: 'Status',
          className: 'text-center',
          cell: (e) => {
              if (e.totalCount === e.usedCount + e.expiredCount) return <Badge variant="neutral">Zakończona</Badge>;
              if (e.statusDistribution.RESERVED === e.totalCount) return <Badge variant="indigo">Rezerwacja</Badge>;
              return <Badge variant="success">Aktywna</Badge>;
          }
      }
  ];

  // --- KOLUMNY DLA WIDOKU LISTY (POJEDYNCZE - STARY WIDOK) ---
  const listColumns: Column<Voucher>[] = [
    {
        header: 'ID Vouchera',
        accessorKey: 'id',
        sortable: true,
        cell: (v) => <span className="font-mono text-[10px] text-slate-600">{v.id}</span>
    },
    {
        header: 'Emisja',
        accessorKey: 'emissionId',
        cell: (v) => <span className="text-[10px] text-slate-400 truncate max-w-[100px] block" title={v.emissionId}>{v.emissionId?.split('-').pop()}</span>
    },
    {
        header: 'Firma',
        accessorKey: 'companyId',
        sortable: true,
        cell: (v) => <span className="font-medium text-slate-800 text-xs">{v.companyId}</span>
    },
    {
        header: 'Status',
        accessorKey: 'status',
        sortable: true,
        className: 'text-center',
        cell: (v) => <StatusBadge status={v.status} />
    },
    {
        header: 'Właściciel',
        accessorKey: 'ownerId',
        cell: (v) => <span className="text-slate-400 text-[10px]">{v.ownerId || '-'}</span>
    }
  ];

  const renderEmissionMobile = (e: EmissionGroup) => (
      <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
              <span className="font-mono text-xs font-bold text-slate-700">{e.emissionId}</span>
              <span className="font-bold text-slate-800">{e.totalCount} szt.</span>
          </div>
          <div className="text-xs text-slate-500">
              Firma: <strong>{e.companyId}</strong>
          </div>
          {/* Progress Bar Mini */}
          <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-slate-100 mt-1">
                <div style={{ width: `${(e.usedCount/e.totalCount)*100}%` }} className="bg-blue-500"></div>
                <div style={{ width: `${(e.activeCount/e.totalCount)*100}%` }} className="bg-emerald-500"></div>
                <div style={{ width: `${(e.expiredCount/e.totalCount)*100}%` }} className="bg-amber-400"></div>
          </div>
      </div>
  );

  const renderListMobile = (v: Voucher) => (
      <div className="flex flex-col gap-1">
          <div className="flex justify-between">
             <span className="font-mono text-[10px]">{v.id.split('/').pop()}</span>
             <StatusBadge status={v.status} className="scale-75 origin-right" />
          </div>
          <span className="text-xs font-bold">{v.companyId}</span>
      </div>
  );

  return (
    <div className="space-y-4">
        {/* Toggle Bar */}
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-3">
            <Tabs 
                activeTab={viewMode}
                onChange={(id) => setViewMode(id as 'EMISSIONS' | 'LIST')}
                items={[
                    { id: 'EMISSIONS', label: 'Emisje (Pakiety)', icon: <Layers size={14}/> },
                    { id: 'LIST', label: 'Pojedyncze', icon: <List size={14}/> }
                ]}
            />
            
            <div className="hidden md:flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> W Obiegu</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Zużyte</span>
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Wygasłe</span>
            </div>
        </div>

        {viewMode === 'EMISSIONS' ? (
            <DataTable 
                data={emissionsData}
                columns={emissionColumns}
                mobileRenderer={renderEmissionMobile}
                title="Rejestr Emisji (Partie)"
                subtitle="Zagregowany widok wygenerowanych pakietów voucherów"
                searchPlaceholder="Szukaj ID Emisji, Firmy..."
                searchableFields={['emissionId', 'companyId']}
            />
        ) : (
            <DataTable 
                data={vouchers}
                columns={listColumns}
                mobileRenderer={renderListMobile}
                title="Pełna Lista Voucherów"
                subtitle="Szczegółowy podgląd wszystkich znaków (może działać wolniej)"
                searchPlaceholder="Szukaj ID Vouchera..."
                searchableFields={['id', 'companyId', 'ownerId']}
            />
        )}
    </div>
  );
};
