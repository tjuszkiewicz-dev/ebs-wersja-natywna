'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy } from 'lucide-react';
import type { LeaderboardEntry, Period } from '@/lib/crm/leaderboard';

const MEDAL: Record<'gold' | 'silver' | 'bronze', string> = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
};

const PODIUM_ORDER: Array<'silver' | 'gold' | 'bronze'> = ['silver', 'gold', 'bronze'];

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Podium skeleton */}
      <div className="flex items-end justify-center gap-4">
        {[80, 104, 80].map((h, i) => (
          <div
            key={i}
            className="animate-pulse bg-gray-200 rounded-xl flex-1 max-w-[180px]"
            style={{ height: `${h}px` }}
          />
        ))}
      </div>
      {/* Table skeleton */}
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse bg-gray-200 rounded h-10" />
        ))}
      </div>
    </div>
  );
}

interface PodiumCardProps {
  entry: LeaderboardEntry;
  isFirst: boolean;
}

function PodiumCard({ entry, isFirst }: PodiumCardProps) {
  const badge = entry.badge as 'gold' | 'silver' | 'bronze';
  const borderColor = badge === 'gold' ? '#c9a227' : badge === 'silver' ? '#94a3b8' : '#b45309';
  const bgColor = badge === 'gold' ? '#fefce8' : badge === 'silver' ? '#f8fafc' : '#fff7ed';

  return (
    <div
      className={`flex flex-col items-center rounded-xl border-2 p-4 shadow-sm text-center flex-1 max-w-[200px] transition-all ${
        isFirst ? 'scale-105' : ''
      }`}
      style={{ borderColor, backgroundColor: bgColor }}
    >
      <span className="text-3xl mb-1" role="img" aria-label={badge === 'gold' ? '1 miejsce' : badge === 'silver' ? '2 miejsce' : '3 miejsce'}>{MEDAL[badge]}</span>
      <span className="text-xs font-semibold text-gray-400 mb-1">#{entry.rank}</span>
      <p className="font-bold text-sm text-gray-900 leading-tight mb-3 line-clamp-2">
        {entry.full_name || '—'}
      </p>
      <div className="w-full space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Umowy</span>
          <span className="font-bold" style={{ color: '#4a95a9' }}>
            {entry.deals_closed}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Leady</span>
          <span className="font-semibold text-gray-700">{entry.leads_count}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-500">Konwersja</span>
          <span className="font-semibold" style={{ color: '#c9a227' }}>
            {Math.min(100, entry.conversion_rate).toFixed(2)}%
          </span>
        </div>
      </div>
    </div>
  );
}

export function CrmLeaderboard() {
  const [period, setPeriod] = useState<Period>('month');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/crm/leaderboard?period=${p}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const entries = Array.isArray(data) ? data : data?.entries;
      if (!Array.isArray(entries)) throw new Error(data?.error ?? 'Unexpected response');
      setEntries(entries as LeaderboardEntry[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Błąd ładowania danych');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  const top3 = entries.filter((e) => e.badge !== null) as (LeaderboardEntry & {
    badge: 'gold' | 'silver' | 'bronze';
  })[];
  const rest = entries.filter((e) => e.badge === null);

  // Build podium in silver–gold–bronze order
  const podiumMap = new Map(top3.map((e) => [e.badge, e]));
  const podiumEntries = PODIUM_ORDER.map((b) => podiumMap.get(b)).filter(
    Boolean,
  ) as (LeaderboardEntry & { badge: 'gold' | 'silver' | 'bronze' })[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy size={20} style={{ color: '#4a95a9' }} />
            <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              aria-label="Wybierz okres"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="month">Miesiąc</option>
              <option value="quarter">Kwartał</option>
              <option value="year">Rok</option>
            </select>
            <a
              href={`/api/crm/leaderboard/export?period=${period}`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Eksportuj raport
            </a>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <p className="text-center text-red-500 py-8 text-sm">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">Brak danych za wybrany okres</p>
        ) : (
          <div className="space-y-8">
            {/* Podium */}
            {podiumEntries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4 text-center">
                  Top 3
                </p>
                <div className="flex items-end justify-center gap-3 flex-wrap">
                  {podiumEntries.map((entry) => (
                    <PodiumCard
                      key={entry.user_id}
                      entry={entry}
                      isFirst={entry.badge === 'gold'}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Ranking table */}
            {rest.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Pozostałe miejsca
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" aria-label="Ranking sprzedawców">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">
                          Miejsce
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Handlowiec
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Leady
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Umowy
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Konwersja%
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rest.map((entry, idx) => (
                        <tr
                          key={entry.user_id}
                          className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                        >
                          <td className="px-4 py-3 text-gray-500 font-medium">
                            #{entry.rank}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {entry.full_name || '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {entry.leads_count}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold" style={{ color: '#4a95a9' }}>
                            {entry.deals_closed}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold" style={{ color: '#c9a227' }}>
                            {Math.min(100, entry.conversion_rate).toFixed(2)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
