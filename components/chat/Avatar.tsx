'use client';
// Awatar komunikatora: inicjały w deterministycznym kolorze albo ikona grupy.
import React from 'react';
import { Users } from 'lucide-react';
import { initials, hue } from '@/lib/chat/format';

export function Avatar({ name, group, size = 44, online }: { name: string; group?: boolean; size?: number; online?: boolean }) {
  return (
    <span className="relative inline-flex shrink-0">
      <span className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
        style={{ width: size, height: size, fontSize: size * 0.36, backgroundColor: group ? '#059669' : `hsl(${hue(name)},40%,50%)` }}>
        {group ? <Users size={size * 0.5} /> : initials(name || '?')}
      </span>
      {online && <span title="Online" className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-primary-500" />}
    </span>
  );
}
