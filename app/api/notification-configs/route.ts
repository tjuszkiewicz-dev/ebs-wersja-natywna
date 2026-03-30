import { NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

// GET /api/notification-configs — lista konfiguracji powiadomień
export async function GET() {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!['superadmin', 'pracodawca'].includes(auth.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = supabaseServer();
  let query = supabase
    .from('notification_configs')
    .select('*')
    .order('created_at', { ascending: true });

  // Pracodawca widzi tylko konfiguracje swojej firmy
  if (auth.role === 'pracodawca') {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('company_id')
      .eq('id', auth.id)
      .single();
    if (profile?.company_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      query = (query as any).eq('company_id', profile.company_id);
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
