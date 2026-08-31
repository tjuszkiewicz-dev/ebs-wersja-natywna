// GET  /api/crm/leads/[id]/activities — oś czasu aktywności klienta
// POST /api/crm/leads/[id]/activities — ręczna aktywność { type, body }
// Port z BBS-Unified (E7a). To JEDYNA żywa ścieżka aktywności — samodzielne
// `app/api/crm/activities/*` w BBS stoi na nieistniejącej tabeli `crm_client_activities`
// i świadomie nie zostało przeniesione (spec §4.2).
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, admin } from '@/lib/crm/visibility';
import { logActivity, type ActivityType } from '@/lib/crm/activities';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TYPES: ActivityType[] = ['NOTE', 'CALL', 'EMAIL', 'MEETING'];

async function canAccessLead(callerId: string, callerRole: string, leadId: string): Promise<boolean> {
  if (callerRole === 'superadmin') return true;
  const { data: lead } = await (admin() as any).from('leads').select('assigned_to').eq('id', leadId).single();
  if (!lead) return false;
  if (!lead.assigned_to) return ['menedzer', 'dyrektor', 'koordynator'].includes(callerRole);
  const visibleIds = await getVisibleUserIds(callerId, callerRole);
  if (visibleIds === null) return true;
  return visibleIds.includes(lead.assigned_to);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.pipeline'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!(await canAccessLead(auth.id, auth.role, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await (admin() as any)
    .from('crm_activities')
    .select('id, type, body, author_name, is_system, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.pipeline'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  if (!(await canAccessLead(auth.id, auth.role, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const type = (body?.type || 'NOTE') as ActivityType;
  const text = (body?.body || '').trim();
  if (!text) return NextResponse.json({ error: 'Pusta treść' }, { status: 400 });
  if (!VALID_TYPES.includes(type)) return NextResponse.json({ error: 'Nieprawidłowy typ' }, { status: 400 });
  if (text.length > 5000) return NextResponse.json({ error: 'Treść za długa (max 5000)' }, { status: 400 });

  await logActivity({ leadId: id, type, body: text, authorId: auth.id, isSystem: false });
  return NextResponse.json({ ok: true }, { status: 201 });
}
