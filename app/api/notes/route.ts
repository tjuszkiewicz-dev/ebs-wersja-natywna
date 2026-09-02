// GET /api/notes — lista notatek głosowych (E7e), przefiltrowana widocznością CRM.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { can } from '@/lib/permissions/server';
import { getVisibleUserIds, applyVisibilityFilter, admin } from '@/lib/crm/visibility';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth || !(await can(auth, 'crm.notatki'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const leadId = new URL(req.url).searchParams.get('leadId');

  let query = (admin() as any)
    .from('crm_voice_notes')
    .select('id, lead_id, created_by, title, summary, email_drafts, created_events, created_tasks, origin, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (leadId) query = query.eq('lead_id', leadId);

  query = applyVisibilityFilter(query, await getVisibleUserIds(auth.id, auth.role), false, 'created_by');

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ notes: data ?? [] });
}
