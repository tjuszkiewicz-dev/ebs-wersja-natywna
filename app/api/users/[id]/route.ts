import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const UpdateSchema = z.object({
    full_name:      z.string().min(2).optional(),
    department:     z.string().optional(),
    position:       z.string().optional(),
    phone_number:   z.string().optional(),
    contract_type:  z.enum(['UOP', 'UZ']).optional(),
    hire_date:      z.string().optional(),
    address_street: z.string().optional(),
    address_zip:    z.string().optional(),
    address_city:   z.string().optional(),
}).strict();

// PATCH /api/users/[id] — zaktualizuj dane pracownika
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await getAuthUserWithRole();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Użytkownik może edytować swój profil, HR/superadmin może edytować innych
    const isSelf = auth.id === params.id;
    const canEdit = isSelf || ['superadmin', 'pracodawca'].includes(auth.role);
    if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = supabaseServer();
    const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...parsed.data, updated_at: new Date().toISOString() })
        .eq('id', params.id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
