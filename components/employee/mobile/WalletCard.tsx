
import React, { useEffect, useRef } from 'react';
import { User } from '../../../types';
import { ShieldCheck, Sparkles } from 'lucide-react';

interface WalletCardProps {
  user: User;
  onFlip?: () => void;
}

// EBS brand colors: #7C3AED (violet), #2563EB (blue), #22C55E (green)
export const WalletCard: React.FC<WalletCardProps> = ({ user }) => {
  const balanceRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = balanceRef.current;
    if (!el) return;
    const target = user.voucherBalance ?? 0;
    const start = 0;
    const duration = 1200;
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (target - start) * eased).toString();
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [user.voucherBalance]);

  return (
    <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl" style={{ minHeight: 200 }}>
      {/* Animated gradient background */}
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 20%, #1d4ed8 45%, #0f766e 70%, #15803d 100%)',
        backgroundSize: '300% 300%',
        animation: 'ebsCardGrad 8s ease infinite',
      }}/>
      {/* Noise texture overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")',
      }}/>
      {/* Glowing orbs */}
      <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-40" style={{ background: '#7C3AED' }}/>
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full blur-3xl opacity-30" style={{ background: '#22C55E' }}/>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-32 rounded-full blur-3xl opacity-20" style={{ background: '#2563EB' }}/>

      {/* Shimmer line top */}
      <div className="absolute top-0 left-0 right-0 h-px" style={{
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
        animation: 'ebsShimmer 3s ease infinite',
      }}/>

      {/* Content */}
      <div className="relative z-10 p-6 flex flex-col gap-6" style={{ color: 'white' }}>
        {/* Top row */}
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>Eliton Benefits System</span>
            </div>
            <p className="text-xs font-semibold flex items-center gap-1" style={{ color: '#86efac' }}>
              <ShieldCheck size={11}/> Verified Employee
            </p>
          </div>
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}>
            <Sparkles size={10} style={{ color: '#fbbf24' }}/> Premium
          </div>
        </div>

        {/* Balance hero */}
        <div>
          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.45)' }}>Dostępne środki</p>
          <div className="flex items-end gap-2">
            <span ref={balanceRef} className="font-black leading-none" style={{ fontSize: 48, letterSpacing: '-0.03em', textShadow: '0 0 40px rgba(34,197,94,0.5)' }}>
              {user.voucherBalance ?? 0}
            </span>
            <span className="mb-2 font-bold text-lg" style={{ color: 'rgba(255,255,255,0.4)' }}>PKT</span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>1 punkt = 1 PLN · do wykorzystania na benefity</p>
        </div>

        {/* Bottom row */}
        <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>Właściciel karty</p>
            <p className="font-semibold text-sm">{user.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>ID konta</p>
            <p className="font-mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>•••• {user.id.slice(-6).toUpperCase()}</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ebsCardGrad {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes ebsShimmer {
          0% { opacity: 0; transform: translateX(-100%); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};
