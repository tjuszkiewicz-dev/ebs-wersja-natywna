import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Building2, RefreshCw, AlertCircle, Loader2,
  Hash, MapPin, ArchiveRestore, Archive, CalendarClock,
} from 'lucide-react';
import { CustomerCard, CustomerCompany } from './CustomerCard';

// ── Main Component ────────────────────────────────────────────────────────────

export const AdminArchiwum: React.FC = () => {
  const [companies,  setCompanies]  = useState<CustomerCompany[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState('');
  const [selected,   setSelected]   = useState<CustomerCompany | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchArchived = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/companies?archived=true');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Filtruj tylko zarchiwizowane po stronie frontu jako zabezpieczenie
      const archived = Array.isArray(data)
        ? data.filter((c: any) => c.archived_at)
        : [];
      setCompanies(archived);
    } catch (e: any) {
      setError(e.message ?? 'Błąd pobierania archiwum');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchArchived(); }, [fetchArchived]);

  const handleRestore = useCallback(async (company: CustomerCompany) => {
    if (!confirm(`Czy na pewno przywrócić firmę "${company.name}" do aktywnych klientów?`)) return;
    setRestoringId(company.id);
    try {
      const res = await fetch(`/api/companies/${company.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unarchive' }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      // Usuń z lokalnej listy od razu
      setCompanies(prev => prev.filter(c => c.id !== company.id));
      if (selected?.id === company.id) setSelected(null);
    } catch (e: any) {
      alert(`Błąd przywracania firmy: ${e.message}`);
    } finally {
      setRestoringId(null);
    }
  }, [selected]);

  const filtered = companies.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.nip.includes(q) ||
      (c.address_city ?? '').toLowerCase().includes(q)
    );
  });

  const formatArchivedAt = (iso: string | null | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pl-PL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-center gap-3">
        <Archive size={18} className="text-amber-600 shrink-0" />
        <p className="text-sm text-amber-800">
          Firmy w archiwum <strong>nie są widoczne</strong> w Bazie klientów ani na listach HR.
          Możesz je w każdej chwili przywrócić.
        </p>
      </div>

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
          onClick={fetchArchived}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Odśwież
        </button>
        <span className="text-xs text-slate-400 font-medium">
          {companies.length} {companies.length === 1 ? 'firma' : 'firm'} w archiwum
        </span>
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
              <Archive size={32} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm font-medium">Archiwum jest puste</p>
              <p className="text-slate-300 text-xs mt-1">Zarchiwizowane firmy pojawią się tutaj</p>
            </div>
          ) : (
            filtered.map((company) => {
              const isRestoring = restoringId === company.id;
              const isSelected  = selected?.id === company.id;
              return (
                <div
                  key={company.id}
                  className={`relative bg-white rounded-2xl border shadow-sm transition group ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50 shadow-md'
                      : 'border-slate-200 hover:border-amber-300 hover:shadow-md'
                  }`}
                >
                  {/* Card body — klikalny */}
                  <button
                    onClick={() => setSelected(isSelected ? null : company)}
                    className="text-left w-full p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-amber-100 text-amber-600'
                      }`}>
                        <Archive size={16} />
                      </div>
                      <div className="min-w-0 flex-1 pr-8">
                        <p className="text-sm font-semibold text-slate-700 truncate">{company.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Hash size={9} />{company.nip}
                          </span>
                          {company.address_city && (
                            <span className="flex items-center gap-1 text-[11px] text-slate-400">
                              <MapPin size={9} />{company.address_city}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-2">
                          <CalendarClock size={11} className="text-amber-500 shrink-0" />
                          <span className="text-[10px] text-amber-700 font-medium">
                            Zarchiwizowano: {formatArchivedAt((company as any).archived_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Restore button — absolute top-right */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRestore(company); }}
                    disabled={isRestoring}
                    title="Przywróć firmę do aktywnych"
                    className="absolute top-3 right-3 flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2 py-1 rounded-lg transition disabled:opacity-50"
                  >
                    {isRestoring
                      ? <Loader2 size={12} className="animate-spin" />
                      : <ArchiveRestore size={12} />
                    }
                    {isRestoring ? 'Przywracanie…' : 'Przywróć'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Customer Card (podgląd zarchiwizowanej firmy) */}
      {selected && (
        <CustomerCard
          key={selected.id}
          company={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
};
