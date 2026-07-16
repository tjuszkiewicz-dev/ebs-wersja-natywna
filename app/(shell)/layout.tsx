// ── Shell layout (server component) ──────────────────────────────────────────
// Otacza wszystkie strony shell: weryfikuje sesję, renderuje TopBar.

import { getViewerApps } from '@/lib/apps/getViewerApps';
import { TopBar } from '@/components/shell/TopBar';
import type { ReactNode } from 'react';

export default async function ShellLayout({ children }: { children: ReactNode }) {
  // Przekieruje na /login gdy brak sesji
  await getViewerApps();

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{
        background:
          'radial-gradient(1200px 600px at 80% -10%, rgba(48,223,106,.10), transparent 60%),' +
          'linear-gradient(165deg, #050807 0%, #0a1410 62%, #0d1f16 100%)',
      }}
    >
      <TopBar />
      <main className="flex flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
