import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Building2, RefreshCw, AlertCircle, Loader2, Hash, MapPin, Archive, Loader } from 'lucide-react';
import { CustomerCard, CustomerCompany } from './CustomerCard';
import { CompanyFormModal } from './CompanyFormModal';

// ── Main Component ────────────────────────────────────────────────────────────

export const AdminBazaKlientow: React.FC = () => {
  const [companies,   setCompanies]   = useState<CustomerCompany[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [search,      setSearch]      = useState('');
  const [selected,    setSelected]    = useState<CustomerCompany | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/companies');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Pokaż tylko aktywne (niezarchiwizowane)
      const active = Array.isArray(data)
        ? data.filter((c: any) => !c.archived_at)
        : [];
      setCompanies(active);
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania firm');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleArchive = useCallback(async (company: CustomerCompany) => {
    if (!confirm(`Czy na pewno przenieść firmę "${company.name}" do archiwum?\n\nFirma zniknie z Bazy klientów. Dane pozostają nienaruszone i można ją przywrócić w zakładce Archiwum.`)) return;
    setArchivingId(company.id);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'archive' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      if (selected?.id === company.id) setSelected(null);
    } catch (e: any) {
      alert(`Błąd archiwizacji: ${e.message}`);
    } finally {
      setArchivingId(null);
    }
  }, [selected]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.nip.includes(q) ||
      (c.address_city ?? '').toLowerCase().includes(q)
    );
  });

  const handleCreated = () => {
    setShowForm(false);
    fetchCompanies();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Szukaj po nazwie, NIP, mieście..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={fetchCompanies}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Odśwież
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
        >
          <Plus size={14} />
          Nowa firma
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 flex justify-center">
          <Loader2 size={28} className="animate-spin text-blue-500" />
        </div>
      )}

      {/* Company list */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
              <Building2 size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm">
                {search ? 'Brak wyników dla podanej frazy' : 'Brak firm w systemie'}
              </p>
            </div>
          ) : (
            filtered.map((company) => {
              const isArchiving = archivingId === company.id;
              const isSelected  = selected?.id === company.id;
              return (
                <div
                  key={company.id}
                  className={`relative bg-white rounded-2xl border shadow-sm transition group ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50 shadow-md'
                      : 'border-slate-200 hover:border-blue-200 hover:shadow-md'
                  }`}
                >
                  {/* Card body — klikalny */}
                  <button
                    onClick={async () => {
                      if (isSelected) { setSelected(null); return; }
                      setDetailLoading(true);
                      try {
                        const res = await fetch(`/api/companies/${company.id}`);
                        const fresh = res.ok ? await res.json() : company;
                        setSelected(fresh);
                      } catch { setSelected(company); }
                      finally { setDetailLoading(false); }
                    }}
                    className="text-left w-full p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600'
                      }`}>
                        <Building2 size={16} />
                      </div>
                      <div className="min-w-0 flex-1 pr-8">
                        <p className="text-sm font-semibold text-slate-800 truncate">{company.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Hash size={9} />{company.nip}
                          </span>
                          {company.address_city && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin size={9} />{company.address_city}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[10px] text-slate-400">
                            Aktywne: <strong className="text-blue-600">{company.balance_active?.toLocaleString('pl-PL') ?? 0} pkt</strong>
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            company.origin === 'CRM_SYNC'
                              ? 'bg-blue-100 text-blue-600'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {company.origin === 'CRM_SYNC' ? 'CRM' : 'Natywna'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Archive button — absolute top-right */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleArchive(company); }}
                    disabled={isArchiving}
                    title="Przenieś do archiwum"
                    className="absolute top-3 right-3 p-1.5 rounded-lg text-slate-300 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 border border-transparent transition disabled:opacity-50"
                  >
                    {isArchiving
                      ? <Loader size={14} className="animate-spin" />
                      : <Archive size={14} />}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Customer Card */}
      {detailLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-blue-500" />
        </div>
      )}
      {!detailLoading && selected && (
        <CustomerCard
          key={selected.id}
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {/* Add company modal */}
      {showForm && (
        <CompanyFormModal
          onClose={() => setShowForm(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};
