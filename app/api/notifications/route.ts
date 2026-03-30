import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

// GET /api/notifications — pobierz powiadomienia zalogowanego użytkownika
export async function GET() {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = supabaseServer();
    const isAdmin = user.role === 'superadmin';

    let query = supabase
        .from('notifications')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);

    if (isAdmin) {
        query = query.or(`user_id.eq.${user.id},user_id.eq.ALL_ADMINS`);
    } else {
        query = query.eq('user_id', user.id);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
}

// POST /api/notifications — utwórz powiadomienie (tylko service_role / wewnętrzne)
export async function POST(req: NextRequest) {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Tylko superadmin lub system może tworzyć powiadomienia dla innych
    if (user.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, message, type = 'INFO', priority, action, targetEntityId, targetEntityType } = body;

    if (!userId || !message) {
        return NextResponse.json({ error: 'userId and message are required' }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
        .from('notifications')
        .insert({
            user_id: userId,
            message,
            type,
            priority,
            action,
            target_entity_id: targetEntityId,
            target_entity_type: targetEntityType,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}

// DELETE /api/notifications — usuń wszystkie powiadomienia zalogowanego użytkownika
export async function DELETE() {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = supabaseServer();
    const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
}
