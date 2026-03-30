
import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, FilterX } from 'lucide-react';

// --- TYPES ---
export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  // Custom render function for complex cells (Avatar, Status, Actions)
  cell?: (item: T) => React.ReactNode;
  className?: string; // Alignments (text-right, etc.)
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  mobileRenderer: (item: T) => React.ReactNode; // Function to render card view on mobile
  searchPlaceholder?: string;
  searchableFields?: (keyof T)[]; // Which fields to search in
  title?: string;
  subtitle?: string;
  headerActions?: React.ReactNode; // Extra buttons in header
}

// --- COMPONENT ---
export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  mobileRenderer,
  searchPlaceholder = "Szukaj...",
  searchableFields = [],
  title,
  subtitle,
  headerActions
}: DataTableProps<T>) {
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState<{ key: keyof T | null; direction: 'asc' | 'desc' }>({
    key: null,
    direction: 'asc',
  });

  // --- LOGIC ---

  // 1. Filtering
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    const lowerTerm = searchTerm.toLowerCase();
    return data.filter((item) =>
      searchableFields.some((field) => {
        const val = item[field];
        return String(val).toLowerCase().includes(lowerTerm);
      })
    );
  }, [data, searchTerm, searchableFields]);

  // 2. Sorting
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return filteredData;
    return [...filteredData].sort((a, b) => {
      // @ts-ignore
      const aVal = a[sortConfig.key!];
      // @ts-ignore
      const bVal = b[sortConfig.key!];

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortConfig]);

  // 3. Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Handlers
  const handleSort = (key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col w-full">
      
      {/* --- HEADER BAR --- */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Title Section */}
        <div className="flex-1">
            {title && <h3 className="text-base font-bold text-slate-800">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Actions & Search */}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
           {/* Search Input */}
           <div className="relative group">
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full sm:w-64 text-slate-700 placeholder:text-slate-400 transition-all bg-white"
              />
              <Search size={16} className="absolute left-3 top-2.5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
           </div>
           
           {/* Custom Actions (e.g. Export Button) */}
           {headerActions}
        </div>
      </div>

      {/* --- CONTENT --- */}
      
      {/* DESKTOP: Table View */}
      <div className="hidden md:block overflow-x-auto custom-scrollbar rounded-b-xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-sm border-b border-slate-200">
            <tr>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  onClick={() => col.sortable && col.accessorKey ? handleSort(col.accessorKey) : undefined}
                  className={`px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap ${
                    col.sortable ? 'cursor-pointer hover:bg-slate-100/50 hover:text-slate-700 transition-colors select-none group' : ''
                  } ${col.className || ''}`}
                >
                  <div className={`flex items-center gap-1 ${col.className?.includes('text-right') ? 'justify-end' : ''}`}>
                    {col.header}
                    {col.sortable && (
                      <span className="text-slate-400 group-hover:text-slate-600">
                        {sortConfig.key === col.accessorKey ? (
                          sortConfig.direction === 'asc' ? <ArrowUp size={12}/> : <ArrowDown size={12}/>
                        ) : (
                          <ArrowUpDown size={12} className="opacity-0 group-hover:opacity-100 transition-opacity"/>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedData.length > 0 ? (
              paginatedData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors group">
                  {columns.map((col, idx) => (
                    <td key={idx} className={`px-6 py-4 text-sm text-slate-700 whitespace-nowrap ${col.className || ''}`}>
                      {col.cell 
                        ? col.cell(item) 
                        : (col.accessorKey ? String(item[col.accessorKey]) : '')}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <FilterX size={32} className="opacity-50"/>
                    <p>Nie znaleziono danych spełniających kryteria.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE: Stacked List View */}
      <div className="md:hidden bg-slate-50/50 p-4 space-y-3">
         {paginatedData.length > 0 ? (
           paginatedData.map((item) => (
             <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                {mobileRenderer(item)}
             </div>
           ))
         ) : (
            <div className="text-center py-8 text-slate-400">
                <p>Brak wyników.</p>
            </div>
         )}
      </div>

      {/* --- FOOTER: Pagination --- */}
      <div className="p-4 border-t border-slate-100 bg-white rounded-b-xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <span className="text-xs text-slate-500 font-medium">
          Strona {currentPage} z {totalPages || 1} • Rekordów: {filteredData.length}
        </span>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={16} />
          </button>
          
          {/* Simple Page Numbers */}
          <div className="flex gap-1">
             {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                 let p = i + 1;
                 if (totalPages > 5 && currentPage > 3) p = currentPage - 2 + i;
                 if (p > totalPages) return null;
                 
                 return (
                    <button
                        key={p}
                        onClick={() => goToPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition ${
                            currentPage === p 
                            ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20' 
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        {p}
                    </button>
                 )
             })}
          </div>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
