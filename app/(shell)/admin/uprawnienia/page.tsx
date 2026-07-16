// ── /admin/uprawnienia — tylko superadmin ─────────────────────────────────────
import { redirect } from 'next/navigation';
import { getViewerApps } from '@/lib/apps/getViewerApps';
import { Role } from '@/types/enums';
import { EntitlementsPanel } from '@/components/shell/EntitlementsPanel';

export const metadata = { title: 'Uprawnienia użytkowników — Eliton Benefits System' };

export default async function UprawnieniaSuperadminPage() {
  const { role } = await getViewerApps();

  if (role !== Role.SUPERADMIN) {
    redirect('/launcher');
  }

  return (
    <div className="flex-1 p-6 md:p-8">
      <h1 className="text-2xl font-semibold text-white mb-6">
        Uprawnienia użytkowników
      </h1>
      <EntitlementsPanel />
    </div>
  );
}
