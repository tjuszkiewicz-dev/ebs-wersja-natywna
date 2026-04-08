// PATCH /api/employees/[id] — reset hasła pracownika przez HR
// GET  /api/employees/[id] — dane pracownika z temp_password

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

type RouteContext = { params: Promise<{ id: string }> };

// ── GET — pobierz dane pracownika (w tym temp_password) ──────────────────────
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const supabase = supabaseServer();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, temp_password, company_id')
    .eq('id', id)
    .single() as any;

  if (error || !data) return NextResponse.json({ error: 'Nie znaleziono pracownika' }, { status: 404 });

  // Autoryzacja: pracodawca może widzieć tylko swoich pracowników
  if (auth.role === 'pracodawca') {
    const { data: hrProfile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', auth.id)
      .single();
    if (hrProfile?.company_id !== data.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const { data: authUser } = await supabase.auth.admin.getUserById(id);

  return NextResponse.json({
    id: data.id,
    email: authUser?.user?.email ?? '',
    tempPassword: data.temp_password ?? null,
  });
}

// ── PATCH — reset hasła pracownika ───────────────────────────────────────────
const ResetSchema = z.object({
  newPassword: z.string().min(8).optional(),  // jeśli brak — generuj automatycznie
});

function generatePassword(): string {
  return (
    Math.random().toString(36).slice(2, 6).toUpperCase() +
    Math.random().toString(36).slice(2, 6) +
    Math.floor(10 + Math.random() * 90) +
    '!'
  );
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = ResetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = supabaseServer();

  // Sprawdź czy pracownik istnieje i należy do firmy HR
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, company_id')
    .eq('id', id)
    .eq('role', 'pracownik')
    .single();

  if (!profile) return NextResponse.json({ error: 'Nie znaleziono pracownika' }, { status: 404 });

  if (auth.role === 'pracodawca') {
    const { data: hrProfile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', auth.id)
      .single();
    if (hrProfile?.company_id !== profile.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const newPassword = parsed.data.newPassword ?? generatePassword();

  // Zmień hasło w Supabase Auth
  const { error: authError } = await supabase.auth.admin.updateUserById(id, {
    password: newPassword,
  });
  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  // Zapisz temp_password w profilu
  await supabase
    .from('user_profiles')
    .update({ temp_password: newPassword, updated_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ newPassword });
}
