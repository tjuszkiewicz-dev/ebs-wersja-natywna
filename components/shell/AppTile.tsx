import Link from 'next/link';
import { Gift, HardHat, FileText, MessageSquare, BookOpen, ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { AppDef, AppId } from '@/lib/apps/registry';

const ICON_MAP: Record<string, LucideIcon> = {
  'gift':     Gift,
  'hard-hat': HardHat,
  'file':     FileText,
  'chat':     MessageSquare,
  'book':     BookOpen,
};

// Krótkie opisy kafelków (Partial — przyszłe appki dopisują swoje w E2+)
const DESCRIPTIONS: Partial<Record<AppId, string>> = {
  benefity: 'Vouchery i benefity pracownicze w jednym miejscu.',
};

interface AppTileProps {
  app: AppDef;
}

export function AppTile({ app }: AppTileProps) {
  const Icon = ICON_MAP[app.icon] ?? Gift;

  return (
    <Link
      href={app.route}
      className="group relative flex flex-col gap-5 rounded-2xl p-7
                 border border-white/10 bg-white/[0.04]
                 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.6)]
                 transition-all duration-300 ease-out
                 hover:-translate-y-1.5 hover:border-primary-400/40 hover:bg-white/[0.06]
                 hover:shadow-[0_26px_60px_-24px_rgba(0,0,0,0.7)]"
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-primary-400/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <span
        className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary-400/25
                   transition-transform duration-300 group-hover:scale-105"
        style={{ background: 'linear-gradient(150deg, rgba(48,223,106,.16), rgba(48,223,106,.03))' }}
      >
        <Icon size={28} strokeWidth={1.7} className="text-primary-300" />
      </span>

      <div>
        <h3 className="font-sans text-lg font-bold tracking-tight text-white">
          {app.name}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">
          {DESCRIPTIONS[app.id] ?? ''}
        </p>
      </div>

      <span className="mt-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-300/80 transition-colors group-hover:text-secondary-500">
        Otwórz
        <ArrowUpRight size={15} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </span>
    </Link>
  );
}
