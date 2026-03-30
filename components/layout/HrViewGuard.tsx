import React from 'react';
import { AlertCircle, LogOut, RotateCcw } from 'lucide-react';
import { Company, User } from '../../types';

interface HrViewGuardProps {
  currentUser: User;
  companies: Company[];
  onLogout: () => void;
  children: (company: Company) => React.ReactNode;
}

/**
 * Resolves the company for an HR user and renders the error UI if none is found.
 * Extracts the company-resolution + guard pattern from App.tsx so it can be
 * tested and reused independently.
 */
export const HrViewGuard: React.FC<HrViewGuardProps> = ({ currentUser, companies, onLogout, children }) => {
  let company = companies.find(c => c.id === currentUser.companyId);

  if (!company && companies.length > 0) {
    console.warn('Company mismatch for HR user. Falling back to first available company.');
    company = companies[0];
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8">
        <div className="bg-red-50 p-4 rounded-full mb-4">
          <AlertCircle size={48} className="text-red-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Błąd Konfiguracji Konta</h3>
        <p className="text-slate-500 mb-6 max-w-md">
          Twoje konto HR nie jest przypisane do żadnej aktywnej firmy w systemie.
          Skontaktuj się z administratorem lub zresetuj dane aplikacji.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition shadow-lg flex items-center gap-2"
          >
            <LogOut size={16} /> Wyloguj się
          </button>
          <button
            onClick={() => {
              if (confirm('To przywróci ustawienia domyślne aplikacji. Utracisz wprowadzone zmiany. Kontynuować?')) {
                localStorage.clear();
                window.location.reload();
              }
            }}
            className="px-6 py-2.5 bg-white border border-red-200 text-red-600 rounded-xl font-bold text-sm hover:bg-red-50 transition shadow-sm flex items-center gap-2"
          >
            <RotateCcw size={16} /> Napraw (Reset Danych)
          </button>
        </div>
      </div>
    );
  }

  return <>{children(company)}</>;
};
