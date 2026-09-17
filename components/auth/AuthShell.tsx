'use client';

// Powłoka ekranów logowania/odzyskiwania hasła — kontynuacja strony marketingowej
// elitonbenefits.pl: to samo tło (aurora nad #080c0a, winieta, wygaszenie u dołu),
// ten sam nagłówek z logo i wordmarkiem, ta sama stopka. Użytkownik klikający
// „Zaloguj się" na stronie ma trafić na ekran, który wygląda jak jej następna sekcja.

import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';

const SoftAurora = dynamic(() => import('@/components/ui/SoftAurora'), { ssr: false });

export const SITE_URL = 'https://elitonbenefits.pl';

interface AuthShellProps {
  children: React.ReactNode;
  /** Kolumna brandowa po lewej (desktop). Bez niej treść jest wyśrodkowana. */
  aside?: React.ReactNode;
  /** Akcja po prawej stronie nagłówka (np. link „Dołącz do EBS"). */
  headerAction?: React.ReactNode;
}

export default function AuthShell({ children, aside, headerAction }: AuthShellProps) {
  // Aurora to ciągła animacja WebGL — przy prefers-reduced-motion zostaje statyczna poświata.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-[#080c0a] font-sans text-white">
      {/* Tło: warstwy 1:1 jak hero strony (aurora → winieta radialna → wygaszenie do #080c0a). */}
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
        {reducedMotion ? (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(22,163,74,0.16)_0%,transparent_60%)]" />
        ) : (
          <div className="absolute inset-0 animate-fade-in-slow">
            <SoftAurora
              speed={0.35}
              scale={1.2}
              brightness={1.1}
              color1="#30df6a"
              color2="#4297cd"
              noiseFrequency={2}
              noiseAmplitude={3}
              bandHeight={0.7}
              bandSpread={1}
              octaveDecay={0.27}
              layerOffset={0.25}
              colorSpeed={1}
              enableMouseInteraction={false}
            />
          </div>
        )}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(8,12,10,0.65)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#080c0a] to-transparent" />
      </div>

      <header className="relative z-10">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-5 lg:h-[88px] lg:px-8">
          <a
            href={SITE_URL}
            className="flex items-center gap-2 rounded-full transition-opacity duration-300 ease-ebs hover:opacity-80 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/20"
          >
            <img
              src="/ebs-black.svg"
              alt="EBS"
              width={72}
              height={72}
              className="h-14 w-14 object-contain brightness-0 invert lg:h-[72px] lg:w-[72px]"
            />
            <span className="hidden text-[17px] font-bold tracking-[-0.02em] sm:inline">Eliton Benefits System</span>
          </a>
          {headerAction}
        </div>
      </header>

      <main className="relative z-10 flex w-full flex-1 items-center">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-8 lg:px-8 lg:py-12">
          {aside ? (
            <div className="grid items-center gap-8 sm:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(400px,448px)] lg:gap-16 xl:gap-24">
              <div className="max-w-[640px]">{aside}</div>
              <div className="w-full max-w-[448px] lg:max-w-none">{children}</div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[448px]">{children}</div>
          )}
        </div>
      </main>

      <footer className="relative z-10">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-5 pb-8 pt-4 text-[12px] text-white/50 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>&copy; {new Date().getFullYear()} Stratton Prime sp. z o.o. &middot; Eliton Benefits System</p>
          <a href={SITE_URL} className="-my-2 py-2 transition-colors duration-200 hover:text-white">
            elitonbenefits.pl
          </a>
        </div>
      </footer>
    </div>
  );
}
