import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

// GET /api/notification-configs/[id]
export async function GET(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = supabaseServer();
    const { data, error } = await supabase
        .from('notification_configs')
        .select('*')
        .eq('id', params.id)
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
}

// PATCH /api/notification-configs/[id] — zaktualizuj konfigurację
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (user.role !== 'superadmin' && user.role !== 'pracodawca') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const supabase = supabaseServer();

    const { data, error } = await supabase
        .from('notification_configs')
        .update({ ...body, updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
