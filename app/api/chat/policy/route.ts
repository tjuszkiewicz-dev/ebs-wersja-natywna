// GET/POST /api/chat/policy — blokady par ról „kto z kim NIE rozmawia" (tylko właściciel).
// BRAK wpisu = dozwolone; wpis allowed=false blokuje parę ról personelu. Role zewnętrzne
// i pracownik tymczasowy są poza macierzą — ich reguły niesie lib/chat/policy (K11).
// Port z BBS-Unified (E6a). Ekran macierzy w panelu odłożony (K16) — endpoint działa przez API.
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { requireChatAuth, pairKey } from '@/lib/chat/server';
import { isStaff } from '@/lib/chat/policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireChatAuth();
  if (!auth || !auth.isOwner) return NextResponse.json({ error: 'Tylko Właściciel zarządza polityką komunikatora' }, { status: 403 });
  const sb = admin() as any;
  const [{ data: policy }, { data: roles }, { data: profiles }] = await Promise.all([
    sb.from('chat_policy').select('role_a, role_b, allowed'),
    sb.from('app_roles').select('role, label').order('role'),
    sb.from('user_profiles').select('role'),
  ]);
  // role: z definicji + faktycznie użyte w profilach (np. leadowiec bez wpisu w app_roles)
  const known = new Map<string, string>((roles || []).map((r: any) => [r.role, r.label || r.role]));
  for (const p of profiles || []) if (p.role && !known.has(p.role)) known.set(p.role, p.role);
  return NextResponse.json({
    roles: [...known.entries()].filter(([role]) => isStaff(role)).map(([role, label]) => ({ role, label })),
    blocked: (policy || []).filter((p: any) => !p.allowed).map((p: any) => [p.role_a, p.role_b]),
  });
}

// POST { role_a, role_b, allowed } — przełączenie jednej pary
export async function POST(request: NextRequest) {
  const auth = await requireChatAuth();
  if (!auth || !auth.isOwner) return NextResponse.json({ error: 'Tylko Właściciel zarządza polityką komunikatora' }, { status: 403 });
  const b = await request.json().catch(() => null);
  if (!b?.role_a || !b?.role_b) return NextResponse.json({ error: 'Brak pary ról' }, { status: 400 });
  const [a, bb] = pairKey(String(b.role_a), String(b.role_b));
  const allowed = b.allowed !== false;
  const sb = admin() as any;
  if (allowed) {
    await sb.from('chat_policy').delete().eq('role_a', a).eq('role_b', bb); // brak wpisu = dozwolone
  } else {
    const { error } = await sb.from('chat_policy').upsert({ role_a: a, role_b: bb, allowed: false }, { onConflict: 'role_a,role_b' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
