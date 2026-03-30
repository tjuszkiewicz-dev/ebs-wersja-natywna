
import React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { ImportHistoryEntry, Company, User } from '../../../types';
import { DocumentDownloadButton } from '../../Documents/DocumentDownloadButton';
import { DataTable, Column } from '../../ui/DataTable';
import { StatusBadge } from '../../ui/StatusBadge';

// Declare XLSX for Excel generation
declare const XLSX: any;

interface HRImportHistoryTableProps {
  history: ImportHistoryEntry[];
  company: Company;
  hrUser?: User;
  onDownloadExcel?: (entry: ImportHistoryEntry) => void; // Optional if we handle it internally now
}

export const HRImportHistoryTable: React.FC<HRImportHistoryTableProps> = ({ 
  history, 
  company, 
  hrUser,
  onDownloadExcel // Kept for API compatibility but logic is inside
}) => {

  const handleGenerateExcel = (entry: ImportHistoryEntry) => {
      if (typeof XLSX === 'undefined') {
          alert('Biblioteka Excel nie jest dostępna.');
          return;
      }

      // 1. Prepare Header Data (Company Info)
      const headerRows = [
          ["PROTOKÓŁ IMPORTU DANYCH / ONBOARDING"],
          [""],
          ["Firma:", company.name],
          ["NIP:", company.nip],
          ["Data Importu:", new Date(entry.date).toLocaleString()],
          ["Operator:", entry.hrName],
          ["ID Raportu:", entry.id],
          [""],
          ["SZCZEGÓŁOWA LISTA KONT I POŚWIADCZEŃ"]
      ];

      // 2. Prepare User Data (Flattened)
      // Headers
      const tableHeaders = [
          "Lp.", 
          "Imię i Nazwisko", 
          "Email (Login)", 
          "Dział", 
          "Hasło Tymczasowe", 
          "Data Utworzenia", 
          "Status Konta", 
          "Zgody (Regulamin)", 
          "Zgody (RODO)"
      ];

      const users = entry.reportData?.users || [];
      const dataRows = users.map((u: any, index: number) => [
          index + 1,
          u.name,
          u.email,
          u.department || 'Ogólny',
          u.tempPassword || '******', // Should be present in reportData
          new Date(entry.date).toLocaleDateString(), // Creation Date
          "AKTYWNE", // Initial status
          "OCZEKUJE (Pierwsze logowanie)", // Terms Consent Status
          "OCZEKUJE (Pierwsze logowanie)"  // GDPR Consent Status
      ]);

      // 3. Combine
      const wsData = [...headerRows, [], tableHeaders, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      // Styling / Column Widths
      ws['!cols'] = [
          { wch: 5 },  // Lp
          { wch: 25 }, // Name
          { wch: 30 }, // Email
          { wch: 20 }, // Dept
          { wch: 20 }, // Pass
          { wch: 15 }, // Date
          { wch: 15 }, // Status
          { wch: 30 }, // Terms
          { wch: 30 }  // GDPR
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Protokół Importu");
      
      const safeDate = new Date(entry.date).toISOString().slice(0,10);
      XLSX.writeFile(wb, `Protokol_Importu_${safeDate}_${entry.id}.xlsx`);
  };

  const columns: Column<ImportHistoryEntry>[] = [
      {
          header: 'Data',
          accessorKey: 'date',
          sortable: true,
          cell: (h) => <span className="text-xs text-slate-500">{new Date(h.date).toLocaleString()}</span>
      },
      {
          header: 'Operator',
          accessorKey: 'hrName',
          sortable: true,
          cell: (h) => <span className="font-medium text-slate-700">{h.hrName}</span>
      },
      {
          header: 'Przetworzono',
          accessorKey: 'totalProcessed',
          sortable: true,
          className: 'text-center',
          cell: (h) => <span className="font-bold text-slate-800">{h.totalProcessed}</span>
      },
      {
          header: 'Status',
          accessorKey: 'status',
          cell: (h) => <StatusBadge status={h.status} />
      },
      {
          header: 'Raport',
          className: 'text-right',
          cell: (h) => (
            <div className="flex justify-end gap-2">
                <button 
                    onClick={() => handleGenerateExcel(h)}
                    className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded transition shadow-sm border border-green-200"
                    title="Pobierz Protokół (Excel) - Zawiera hasła i zgody"
                >
                    <FileSpreadsheet size={16} />
                </button>
                <DocumentDownloadButton 
                    docName={`Raport_${new Date(h.date).toISOString().slice(0,10)}`}
                    type="IMPORT_REPORT"
                    data={h.reportData}
                    company={company}
                    user={hrUser}
                />
            </div>
          )
      }
  ];

  const renderMobileCard = (h: ImportHistoryEntry) => (
      <div className="flex flex-col gap-2">
          <div className="flex justify-between items-start">
             <div>
                <span className="text-xs text-slate-400 block">{new Date(h.date).toLocaleDateString()}</span>
                <span className="font-bold text-slate-800 text-sm">{h.hrName}</span>
             </div>
             <StatusBadge status={h.status} />
          </div>
          <div className="flex justify-between items-center border-t border-slate-100 pt-2 mt-1">
              <span className="text-xs text-slate-500">Przetworzono kont: {h.totalProcessed}</span>
              <div className="flex gap-2">
                  <button onClick={() => handleGenerateExcel(h)} className="text-green-600 bg-green-50 p-1.5 rounded"><FileSpreadsheet size={16}/></button>
                  <DocumentDownloadButton 
                    docName="R" type="IMPORT_REPORT" data={h.reportData} company={company} user={hrUser}
                  />
              </div>
          </div>
      </div>
  );

  return (
    <div className="mt-6">
        <DataTable 
            data={history}
            columns={columns}
            mobileRenderer={renderMobileCard}
            title="Historia Importów"
            subtitle="Rejestr operacji masowych (Onboarding)"
            searchPlaceholder="Szukaj..."
        />
    </div>
  );
};
