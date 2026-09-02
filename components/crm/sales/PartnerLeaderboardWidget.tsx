'use client';

import React, { useEffect, useState } from 'react';
import { Trophy, TrendingUp } from 'lucide-react';

interface SelfStanding {
  rank: number;
  total_count: number;
  leads_count: number;
  deals_closed: number;
  conversion_rate: number;
  full_name: string;
}

interface ApiResponse {
  self: SelfStanding | null;
  entries: unknown[];
}

export function PartnerLeaderboardWidget() {
  const [self, setSelf] = useState<SelfStanding | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/crm/leaderboard?period=month')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: ApiResponse) => setSelf(data.self))
      .catch(() => setSelf(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="bg-white border border-slate-200 rounded-xl p-5 animate-pulse h-32" />;
  }

  const hasActivity = self && (self.leads_count > 0 || self.deals_closed > 0);

  return (
    <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-5 flex items-center gap-4">
      <div className="w-14 h-14 rounded-full bg-amber-200 flex items-center justify-center flex-shrink-0">
        <Trophy size={28} className="text-amber-700" />
      </div>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-wide text-amber-700/70 font-semibold">
          Twoja pozycja na leaderboardzie
        </p>
        {!self || !hasActivity ? (
          <>
            <p className="text-lg font-bold text-amber-900 mt-1">Brak sprzedaży w tym miesiącu</p>
            <p className="text-xs text-amber-700 mt-0.5">Zacznij od pierwszej oferty.</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-amber-900 mt-0.5">
              #{self.rank}
              <span className="text-base text-amber-700/70 font-medium"> / {self.total_count}</span>
            </p>
            <p className="text-sm text-amber-800 mt-0.5 flex items-center gap-1">
              <TrendingUp size={14} />
              {self.deals_closed} podpisane • {self.leads_count} leadów • {self.conversion_rate}% konwersji
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default PartnerLeaderboardWidget;
