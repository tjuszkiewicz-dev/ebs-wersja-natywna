import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const ResolveSchema = z.object({
    approved:        z.boolean(),
    rejectionReason: z.string().optional(),
});

// PATCH /api/users/[id]/iban-change-request/resolve — zatwierdź lub odrzuć wniosek
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await getAuthUserWithRole();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (auth.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden — only superadmin' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = ResolveSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = supabaseServer();
    const now = new Date().toISOString();

    // Pobierz wniosek
    const { data: request, error: fetchError } = await supabase
        .from('iban_change_requests')
        .select('*')
        .eq('user_id', params.id)
        .eq('status', 'pending')
        .single();

    if (fetchError || !request) {
        return NextResponse.json({ error: 'No pending request found' }, { status: 404 });
    }

    if (parsed.data.approved) {
        // Zatwierdź — zaktualizuj IBAN w user_profiles i zamknij wniosek
        const [{ error: ibanError }, { error: reqError }] = await Promise.all([
            supabase
                .from('user_profiles')
                .update({ iban: request.new_iban, iban_verified: true, iban_verified_at: now, updated_at: now })
                .eq('id', params.id),
            supabase
                .from('iban_change_requests')
                .update({ status: 'approved', resolved_at: now })
                .eq('id', request.id),
        ]);

        if (ibanError) return NextResponse.json({ error: ibanError.message }, { status: 500 });
        if (reqError)  return NextResponse.json({ error: reqError.message }, { status: 500 });

        return NextResponse.json({ approved: true, newIban: request.new_iban });
    } else {
        // Odrzuć
        const { error } = await supabase
            .from('iban_change_requests')
            .update({
                status:           'rejected',
                rejection_reason: parsed.data.rejectionReason ?? 'Odrzucono przez Administratora',
                resolved_at:      now,
            })
            .eq('id', request.id);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ approved: false });
    }
}
