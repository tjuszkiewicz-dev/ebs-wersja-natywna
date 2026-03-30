
import React from 'react';
import { Company, User } from '../../../types';
import { PDF_LAYOUT } from '../PDF_LAYOUT';

interface Props {
  data: any; // Import Report Data structure
  company: Company;
  user?: User; // HR Operator
}

export const ImportReportTemplate: React.FC<Props> = ({ data, company, user }) => {
  return (
    <div 
        className={PDF_LAYOUT.printClass}
        style={{ 
            width: PDF_LAYOUT.cssWidth, 
            height: PDF_LAYOUT.cssHeight, 
            padding: PDF_LAYOUT.cssPadding,
            fontSize: '10pt',
            fontFamily: 'Inter, sans-serif'
        }}
    >
        <div className="mb-6 border-b border-slate-200 pb-4">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-xl font-bold text-slate-900 uppercase">Raport z Importu Danych</h1>
                    <p className="text-slate-500 text-sm mt-1">Generowanie poświadczeń dostępu (Onboarding)</p>
                </div>
                <div className="text-right text-xs text-slate-500">
                    <p>Data: {data.date ? new Date(data.date).toLocaleString() : '-'}</p>
                    <p>ID Raportu: {data.reportId}</p>
                    <p>Operator: {user?.name || data.hrName || 'System'}</p>
                </div>
            </div>
        </div>

        <div className="mb-6">
            <h2 className="text-sm font-bold text-slate-700 uppercase mb-2">Podsumowanie</h2>
            <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-3 rounded">
                <div>
                    <span className="text-slate-500 block">Firma:</span>
                    <span className="font-bold">{company?.name || 'Nieznana'}</span>
                </div>
                <div>
                    <span className="text-slate-500 block">Zaimportowano Kont:</span>
                    <span className="font-bold text-emerald-600">{data.importedCount}</span>
                </div>
            </div>
        </div>

        <div className="flex-1">
            <h2 className="text-sm font-bold text-slate-700 uppercase mb-2">Dane Logowania Pracowników</h2>
            <table className="w-full text-xs text-left border-collapse border border-slate-200">
                <thead className="bg-slate-100">
                    <tr>
                        <th className="border border-slate-200 p-2">Imię i Nazwisko</th>
                        <th className="border border-slate-200 p-2">Email (Login)</th>
                        <th className="border border-slate-200 p-2">Dział</th>
                        <th className="border border-slate-200 p-2 font-mono text-red-600">Hasło Tymczasowe</th>
                    </tr>
                </thead>
                <tbody>
                    {data.users && data.users.map((u: any, idx: number) => (
                        <tr key={idx} className="border-b border-slate-200">
                            <td className="border border-slate-200 p-2 font-medium">{u.name}</td>
                            <td className="border border-slate-200 p-2">{u.email}</td>
                            <td className="border border-slate-200 p-2">{u.department}</td>
                            <td className="border border-slate-200 p-2 font-mono font-bold bg-yellow-50">{u.tempPassword}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <div className="mt-8 pt-4 border-t border-slate-200 text-[8pt] text-slate-400 text-center">
            <p>Dokument wygenerowany automatycznie przez system EBS. Zawiera poufne dane dostępowe.</p>
            <p>Prosimy o bezpieczne przekazanie haseł pracownikom i ich natychmiastową zmianę po pierwszym logowaniu.</p>
        </div>
    </div>
  );
};
