import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const FinanceSchema = z.object({
    iban:          z.string().min(15).max(34).optional(),
    iban_verified: z.boolean().optional(),
});

// PATCH /api/users/[id]/finance — zaktualizuj dane bankowe (superadmin + pracodawca)
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await getAuthUserWithRole();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['superadmin', 'pracodawca'].includes(auth.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Pracodawca może edytować IBAN tylko pracownikom swojej firmy
    if (auth.role === 'pracodawca') {
        const supabase = supabaseServer();
        const [{ data: target }, { data: hr }] = await Promise.all([
            supabase.from('user_profiles').select('company_id').eq('id', params.id).single(),
            supabase.from('user_profiles').select('company_id').eq('id', auth.id).single(),
        ]);
        if (!target || target.company_id !== hr?.company_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
    }

    const body = await req.json();
    const parsed = FinanceSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase2 = supabaseServer();
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (parsed.data.iban !== undefined) update.iban = parsed.data.iban;
    if (parsed.data.iban_verified !== undefined) {
        update.iban_verified = parsed.data.iban_verified;
        if (parsed.data.iban_verified) update.iban_verified_at = new Date().toISOString();
    }

    const { data, error } = await supabase2
        .from('user_profiles')
        .update(update)
        .eq('id', params.id)
        .select('id, iban, iban_verified, iban_verified_at')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
}
