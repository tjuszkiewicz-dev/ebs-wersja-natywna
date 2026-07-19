// Katalog widoków panelu admina EBS (dla admin_view_config).
// Id = id zakładek Sidebar/DashboardAdminNew.
export interface AdminViewDef { id: string; label: string }

export const ADMIN_VIEWS: AdminViewDef[] = [
  { id: 'admin-pulpit',      label: 'Pulpit' },
  { id: 'admin-klienci',     label: 'Baza klientów' },
  { id: 'admin-platnosci',   label: 'Płatności i faktury' },
  { id: 'admin-archiwum',    label: 'Archiwum' },
  { id: 'admin-vouchery',    label: 'Vouchery' },
  { id: 'admin-buyback',     label: 'Anulowanie subskrypcji' },
  { id: 'admin-szablony',    label: 'Szablony dokumentów' },
  { id: 'admin-logi',        label: 'Logi systemowe' },
  { id: 'admin-uprawnienia', label: 'Uprawnienia' },
  { id: 'admin-ksiegowosc',  label: 'Księgowość' },
];

export const ADMIN_VIEW_IDS = new Set(ADMIN_VIEWS.map(v => v.id));
