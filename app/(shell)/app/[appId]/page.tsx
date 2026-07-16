// ── Host aplikacji (server component) ─────────────────────────────────────────
// Pilnuje dostępu per appka; istniejące dashboardy → redirect wg roli; inaczej placeholder.

import { notFound, redirect } from 'next/navigation';
import { getViewerApps } from '@/lib/apps/getViewerApps';
import { isAppId, APPS } from '@/lib/apps/registry';
import { existingAppTarget } from '@/lib/apps/appTargets';

interface Props {
  params: Promise<{ appId: string }>;
}

export default async function AppPage({ params }: Props) {
  const { appId } = await params;

  if (!isAppId(appId)) {
    notFound();
  }

  const { apps, role } = await getViewerApps();
  if (!apps.includes(appId)) {
    redirect('/launcher');
  }

  // Appki obsługiwane przez istniejące dashboardy EBS → przekieruj wg roli
  const target = existingAppTarget(appId, role);
  if (target) {
    redirect(target);
  }

  const appDef = APPS.find(a => a.id === appId)!;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-white text-3xl font-bold mb-4">
        {appDef.name}
      </h1>
      <p className="text-white/50 text-base max-w-md">
        Moduł w budowie — dochodzi w kolejnym etapie migracji.
      </p>
    </div>
  );
}
