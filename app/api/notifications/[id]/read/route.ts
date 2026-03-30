import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

// PATCH /api/notifications/[id]/read — oznacz jedno powiadomienie jako przeczytane
export async function PATCH(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = supabaseServer();
    const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', params.id)
        .eq('user_id', user.id); // RLS: tylko swoje

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
