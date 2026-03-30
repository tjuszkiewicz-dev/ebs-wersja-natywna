
import React, { useState, useEffect, useRef } from 'react';
import { Clock, LogOut, Activity } from 'lucide-react';
import { useStrattonSystem } from '../../context/StrattonContext';
import { SESSION_CONFIG } from '../../utils/config';

export const SessionGuard: React.FC = () => {
  const { state, actions } = useStrattonSystem();
  const { currentUser } = state;
  
  const [lastActivity, setLastActivity] = useState(Date.now());
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const timerRef = useRef<any>(null);

  // 1. Reset timer on user interaction
  const resetTimer = () => {
      setLastActivity(Date.now());
      setShowWarning(false);
  };

  useEffect(() => {
      if (!currentUser) return;

      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
      const handler = () => resetTimer();

      events.forEach(evt => window.addEventListener(evt, handler));

      // 2. Check interval
      timerRef.current = setInterval(() => {
          const now = Date.now();
          const inactiveDuration = now - lastActivity;
          const remaining = SESSION_CONFIG.IDLE_LIMIT_MS - inactiveDuration;

          if (remaining <= 0) {
              // Timeout reached
              actions.addToast("Sesja Wygasła", "Zostałeś wylogowany z powodu braku aktywności.", "WARNING");
              actions.logout();
              setShowWarning(false);
          } else if (remaining <= SESSION_CONFIG.WARNING_THRESHOLD_MS) {
              // Warning zone
              setShowWarning(true);
              setTimeLeft(Math.ceil(remaining / 1000));
          } else {
              setShowWarning(false);
          }
      }, 1000);

      return () => {
          events.forEach(evt => window.removeEventListener(evt, handler));
          if (timerRef.current) clearInterval(timerRef.current);
      };
  }, [currentUser, lastActivity, actions]);

  if (!currentUser || !showWarning) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center border-t-4 border-amber-500">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <Clock size={32} />
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 mb-2">Sesja Wygasa</h3>
            <p className="text-slate-500 mb-6">
                Ze względów bezpieczeństwa zostaniesz wylogowany za <strong>{timeLeft} sekund</strong>.
            </p>

            <div className="space-y-3">
                <button 
                    onClick={resetTimer}
                    className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition flex items-center justify-center gap-2"
                >
                    <Activity size={18}/> Jestem, przedłuż sesję
                </button>
                <button 
                    onClick={actions.logout}
                    className="w-full py-3 bg-white text-slate-500 font-bold rounded-xl border border-slate-200 hover:bg-slate-50 transition flex items-center justify-center gap-2"
                >
                    <LogOut size={18}/> Wyloguj teraz
                </button>
            </div>
        </div>
    </div>
  );
};
