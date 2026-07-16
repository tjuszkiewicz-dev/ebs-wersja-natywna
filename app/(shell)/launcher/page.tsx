// ── Launcher (server component) ───────────────────────────────────────────────
// Siatka aplikacji dostępnych dla zalogowanego użytkownika.

import { getViewerApps } from '@/lib/apps/getViewerApps';
import { AppTile } from '@/components/shell/AppTile';
import { APPS } from '@/lib/apps/registry';

export const metadata = { title: 'Aplikacje — Eliton Benefits System' };

export default async function LauncherPage() {
  const { apps } = await getViewerApps();

  const visibleApps = APPS.filter(a => apps.includes(a.id));

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-14 sm:py-20">
      <header className="mb-10 sm:mb-12">
        <span className="inline-flex items-center gap-2.5 text-[12px] font-bold uppercase tracking-[0.2em] text-secondary-500">
          <span className="h-px w-7 bg-secondary-500" />
          Platforma
        </span>
        <h1 className="mt-4 font-sans text-3xl font-extrabold tracking-tight text-white sm:text-[34px]">
          Wybierz aplikację
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/55">
          Masz dostęp do poniższych modułów Eliton Benefits. Wybierz, z którym chcesz teraz pracować.
        </p>
      </header>

      {visibleApps.length === 0 ? (
        <p className="text-sm text-white/50">
          Nie masz dostępu do żadnej aplikacji. Skontaktuj się z administratorem.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visibleApps.map(app => (
            <AppTile key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
