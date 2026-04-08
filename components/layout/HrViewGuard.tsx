import React, { useEffect, useState } from 'react';
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
 * When the company is not in the local state (e.g. real Supabase UUID not in mock data),
 * it fetches the company from the API so imports always use the correct company_id.
 */
export const HrViewGuard: React.FC<HrViewGuardProps> = ({ currentUser, companies, onLogout, children }) => {
  const found = companies.find(c => c.id === currentUser.companyId);
  const [fetchedCompany, setFetchedCompany] = useState<Company | null>(null);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    if (found || !currentUser.companyId) return;

    // Company not in local mock state — fetch from API
    fetch(`/api/companies/${currentUser.companyId}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setFetchedCompany({
            id:              data.id,
            name:            data.name ?? '',
            nip:             data.nip ?? '',
            balanceActive:   data.balance_active ?? 0,
            balancePending:  data.balance_pending ?? 0,
            address: data.address_city ? {
              street:     data.address_street ?? '',
              city:       data.address_city ?? '',
              postalCode: data.address_zip ?? '',
              country:    'Polska',
            } : undefined,
          });
        } else {
          setFetchError(true);
        }
      })
      .catch(() => setFetchError(true));
  }, [currentUser.companyId, found]);

  const company = found ?? fetchedCompany;

  // Still loading
  if (!company && !fetchError && currentUser.companyId) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
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

