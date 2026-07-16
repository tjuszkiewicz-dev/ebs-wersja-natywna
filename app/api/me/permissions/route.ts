// GET /api/me/permissions — efektywne uprawnienia zalogowanego (fundament pod dynamiczne menu w E2)
import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { getEffectivePermissions } from '@/lib/permissions/server';
import { supabaseServer } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [perms, roleRow] = await Promise.all([
    getEffectivePermissions(auth.id, auth.role),
    (supabaseServer() as any).from('app_roles').select('label').eq('role', auth.role).maybeSingle(),
  ]);
  return NextResponse.json({
    role: auth.role,
    role_label: roleRow.data?.label ?? null,
    permissions: [...perms],
  });
}
