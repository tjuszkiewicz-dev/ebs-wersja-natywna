import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const RequestSchema = z.object({
    newIban: z.string().min(15).max(34),
    reason:  z.string().min(5).max(500),
});

// POST /api/users/[id]/iban-change-request — złóż wniosek o zmianę IBAN
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await getAuthUserWithRole();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Tylko sam użytkownik może złożyć wniosek dla siebie
    if (auth.id !== params.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = supabaseServer();

    // Sprawdź czy nie ma już otwartego wniosku
    const { data: existing } = await supabase
        .from('iban_change_requests')
        .select('id')
        .eq('user_id', params.id)
        .eq('status', 'pending')
        .single();

    if (existing) {
        return NextResponse.json({ error: 'Pending request already exists' }, { status: 409 });
    }

    const { data, error } = await supabase
        .from('iban_change_requests')
        .insert({
            user_id:  params.id,
            new_iban: parsed.data.newIban.replace(/\s+/g, '').toUpperCase(),
            reason:   parsed.data.reason,
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data, { status: 201 });
}
