// PATCH /api/me/worker/bank — pracownik zmienia SWÓJ numer konta bankowego.
// Wymagane confirm=true (UI pyta dwukrotnie). Zmiana idzie jako powiadomienie
// do administratorów + koordynatora (kontrola oszustw).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { admin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || auth.role !== 'pracownik_tymczasowy') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const b = await request.json().catch(() => ({}));
  if (b.confirm !== true) return NextResponse.json({ error: 'Brak potwierdzenia zmiany' }, { status: 400 });

  const raw = String(b.bank_account || '').replace(/\s+/g, '').toUpperCase();
  // PL: 26 cyfr (z opcjonalnym PL); zagraniczne IBAN: 2 litery + 13-32 znaki
  const okPl = /^(PL)?\d{26}$/.test(raw);
  const okIban = /^[A-Z]{2}[0-9A-Z]{13,32}$/.test(raw);
  if (!okPl && !okIban) return NextResponse.json({ error: 'Nieprawidłowy numer konta (PL: 26 cyfr, zagraniczne: IBAN)' }, { status: 400 });

  const sb = admin();
  const { data: e } = await (sb as any).from('hr_employees').select('id, first_name, last_name, bank_account, coordinator_id').eq('user_id', auth.id).maybeSingle();
  if (!e) return NextResponse.json({ error: 'Brak powiązanej kartoteki' }, { status: 404 });
  const old = e.bank_account || '—';
  if (old.replace(/\s+/g, '').toUpperCase() === raw) return NextResponse.json({ error: 'To ten sam numer konta' }, { status: 400 });

  const { error } = await (sb as any).from('hr_employees').update({ bank_account: raw, updated_at: new Date().toISOString() }).eq('id', e.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const name = `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim();
  const mask = (s: string) => (s.length > 8 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s);

  // powiadom adminów i koordynatora — zmiana konta to wrażliwa operacja
  const { data: admins } = await sb.from('user_profiles').select('id').eq('role', 'superadmin');
  const targets = [...new Set([...(admins || []).map((a: any) => a.id), e.coordinator_id].filter(Boolean))];
  for (const uid of targets) {
    await sb.from('notifications').insert({ user_id: uid, message: `⚠️ Pracownik ${name} zmienił swój numer konta bankowego (${mask(raw)}). Sprawdź w Rejestrze zdarzeń.`, type: 'WARNING' });
  }
  return NextResponse.json({ ok: true, bank_account: raw });
}
