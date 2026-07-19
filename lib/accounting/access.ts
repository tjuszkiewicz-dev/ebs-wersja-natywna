// Dostęp do firm w Księgowości multi-firma (server-only).
// REGUŁA (user): admin (superadmin/dyrektor) WIDZI WSZYSTKO — wszystkie firmy bez członkostwa.
// Rola „ksiegowa" i inne: tylko firmy z acc_company_members (owner/ksiegowa/podglad).
import { admin } from '@/lib/supabaseAdmin';

export const ACC_ADMIN_ROLES = ['superadmin', 'dyrektor'];

export interface CompanyAccess { id: string; name: string; member_role: 'owner' | 'ksiegowa' | 'podglad' | 'admin' }

// Firmy widoczne dla użytkownika (+ jego rola w każdej)
export async function myCompanies(auth: { id: string; role: string }): Promise<CompanyAccess[]> {
  const sb = admin() as any;
  if (ACC_ADMIN_ROLES.includes(auth.role)) {
    const { data } = await sb.from('acc_companies').select('id, name').order('name');
    return (data || []).map((c: any) => ({ id: c.id, name: c.name, member_role: 'admin' as const }));
  }
  const { data } = await sb.from('acc_company_members').select('role, company:acc_companies(id, name)').eq('user_id', auth.id);
  return (data || [])
    .filter((m: any) => m.company)
    .map((m: any) => ({ id: m.company.id, name: m.company.name, member_role: m.role }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name, 'pl'));
}

// Dostęp do KONKRETNEJ firmy; write=true wymaga owner/ksiegowa (podglad = tylko odczyt).
// Zwraca rolę w firmie albo null (brak dostępu).
export async function companyAccess(auth: { id: string; role: string }, companyId: string, write = false): Promise<string | null> {
  if (!companyId) return null;
  if (ACC_ADMIN_ROLES.includes(auth.role)) return 'admin';
  const { data } = await (admin() as any).from('acc_company_members').select('role').eq('company_id', companyId).eq('user_id', auth.id).maybeSingle();
  if (!data) return null;
  if (write && data.role === 'podglad') return null;
  return data.role;
}

// Kolejny numer faktury: PREFIX/N/RRRR (N rośnie w obrębie firmy i roku)
export async function nextInvoiceNumber(companyId: string, issueDate: string): Promise<string> {
  const sb = admin() as any;
  const { data: comp } = await sb.from('acc_companies').select('invoice_prefix').eq('id', companyId).single();
  const prefix = comp?.invoice_prefix || 'FV';
  const year = String(issueDate).slice(0, 4);
  const { data } = await sb.from('acc_invoices').select('number').eq('company_id', companyId).like('number', `${prefix}/%/${year}`);
  let max = 0;
  for (const r of data || []) {
    const m = String(r.number).match(/\/(\d+)\//);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}/${max + 1}/${year}`;
}

export const r2 = (n: number) => Math.round(n * 100) / 100;

// Firma powiązana z modułami EBS (Agencja/Benefity) — do automatycznych wpisów księgowych,
// gdy wpis nie wskazuje firmy jawnie.
export async function hrLinkedCompanyId(): Promise<string | null> {
  const { data } = await (admin() as any).from('acc_companies').select('id').eq('hr_linked', true).limit(1).maybeSingle();
  return data?.id ?? null;
}
