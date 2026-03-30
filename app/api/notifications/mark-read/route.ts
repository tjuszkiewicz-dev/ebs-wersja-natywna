import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

// PATCH /api/notifications/mark-read — oznacz wszystkie jako przeczytane
export async function PATCH() {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = supabaseServer();
    const isAdmin = user.role === 'superadmin';

    let query = supabase
        .from('notifications')
        .update({ read: true })
        .eq('read', false);

    if (isAdmin) {
        query = query.or(`user_id.eq.${user.id},user_id.eq.ALL_ADMINS`);
    } else {
        query = query.eq('user_id', user.id);
    }

    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return new NextResponse(null, { status: 204 });
}
