// GET /api/chat/users — kontakty do NOWEJ rozmowy/grupy: użytkownicy, z którymi wolno rozmawiać.
// Personel → cały personel (bez ról zewnętrznych i pracowników tymczasowych) minus pary
// zablokowane w chat_policy; pracownik tymczasowy → tylko jego koordynator; superadmin → personel
// (role zewnętrzne nie mają UI komunikatora, więc rozmowa z nimi byłaby dla nich niewidoczna).
// Port z BBS-Unified (E6a) z macierzą K11.
import { NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { requireChatAuth, getBlockedPairs, coordinatorOf } from '@/lib/chat/server';
import { canConverse, isStaff, isTempWorker } from '@/lib/chat/policy';
import { roleLabel } from '@/lib/chat/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const [{ data: profiles }, blocked] = await Promise.all([
    (admin() as any).from('user_profiles').select('id, full_name, role').not('full_name', 'is', null).order('full_name'),
    getBlockedPairs(),
  ]);
  const all: any[] = (profiles || []).filter((p: any) => p.id !== auth.id);

  let users: any[];
  if (isTempWorker(auth.role)) {
    const coordinator = await coordinatorOf(auth.id);
    users = coordinator ? all.filter(p => p.id === coordinator) : [];
  } else {
    users = all
      .filter(p => isStaff(p.role))
      .filter(p => canConverse(auth.role, p.role, { idA: auth.id, idB: p.id, blocked }).ok);
  }

  return NextResponse.json({
    users: users.map(p => ({ id: p.id, name: p.full_name || '—', role: p.role || '', role_label: roleLabel(p.role) })),
    me: { id: auth.id, role: auth.role },
  });
}
