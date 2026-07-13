import React, { useEffect, useState } from 'react';
import { Loader2, Save, FileText } from 'lucide-react';

const PLACEHOLDERS = [
  'imie_nazwisko','pesel_nip','adres','nr_ilustracji','liczba_voucherow',
  'wartosc_pln','iban_zbywajacego','email_zbywajacego','data',
];

export default function AdminSzablony() {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/document-templates/buyback_agreement')
      .then(r => r.json())
      .then(d => { if (d.html) setHtml(d.html); else setMsg(d.error ? 'Nie udało się wczytać szablonu' : null); })
      .catch(() => setMsg('Nie udało się wczytać szablonu'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/document-templates/buyback_agreement', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ html }),
      });
      if (!res.ok) {
        const d = await res.json();
        const errMsg = typeof d.error === 'string' ? d.error : `Błąd zapisu (HTTP ${res.status})`;
        throw new Error(errMsg);
      }
      setMsg('Zapisano.');
    } catch (e: any) { setMsg(e.message ?? 'Błąd zapisu'); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-slate-400"><Loader2 className="animate-spin inline mr-2" size={16}/>Ładowanie…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-slate-800 font-bold"><FileText size={18}/> Szablon: Umowa odkupu voucherów</div>
      <div className="text-xs text-slate-500">Dostępne pola (wstaw w treści jako <code>{'{{pole}}'}</code>):
        <div className="mt-1 flex flex-wrap gap-1">
          {PLACEHOLDERS.map(p => <span key={p} className="px-2 py-0.5 bg-slate-100 rounded font-mono text-[11px]">{`{{${p}}}`}</span>)}
        </div>
      </div>
      <textarea value={html} onChange={e => setHtml(e.target.value)} spellCheck={false}
        className="w-full h-[520px] p-3 border border-slate-200 rounded-lg font-mono text-xs" />
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60">
          {saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Zapisz szablon
        </button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </div>
  );
}
