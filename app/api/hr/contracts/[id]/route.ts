// GET/PATCH/DELETE /api/hr/contracts/[id]
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can, canAny } from '@/lib/permissions/server';
import { AGENCJA_TABS } from '@/lib/permissions/registry';
import { admin } from '@/lib/supabaseAdmin';
import { geocodeAddress } from '@/lib/hr/geo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HR_ROLES = ['superadmin', 'dyrektor', 'hr', 'hr_panel', 'pracodawca', 'koordynator'];
const FIELDS = ['name', 'employer', 'address', 'contact_person', 'phone', 'status', 'notes'];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { data, error } = await (admin() as any).from('hr_contracts').select('*').eq('id', id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await canAny(auth, AGENCJA_TABS))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // koordynator tylko przegląda kontrakty — bez edycji
  if (auth.role === 'koordynator') return NextResponse.json({ error: 'Koordynator nie może zmieniać danych kontraktu' }, { status: 403 });
  const { id } = await params;
  const b = await request.json().catch(() => ({}));
  const patch: any = { updated_at: new Date().toISOString() };
  for (const f of FIELDS) if (f in b) patch[f] = typeof b[f] === 'string' ? (b[f].trim() || null) : b[f];
  // zmiana adresu magazynu → przelicz współrzędne (odległości z noclegów)
  if (patch.address) {
    const pt = await geocodeAddress(patch.address);
    if (pt) { patch.lat = pt.lat; patch.lng = pt.lng; patch.geocoded_at = new Date().toISOString(); }
  }
  const { data, error } = await (admin() as any).from('hr_contracts').update(patch).eq('id', id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'agencja.delete'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const { data: c } = await (admin() as any).from('hr_contracts').select('name').eq('id', id).single();
  // pracownicy: FK on delete set null → zostają, bez kontraktu
  const { error } = await (admin() as any).from('hr_contracts').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
