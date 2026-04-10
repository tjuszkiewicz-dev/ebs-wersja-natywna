import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

// POST /api/users/[id]/anonymize — RODO: prawo do zapomnienia
// Nadpisuje dane osobowe, zachowuje historię transakcji (retencja księgowa)
export async function POST(
    _req: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await getAuthUserWithRole();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (auth.role !== 'superadmin') {
        return NextResponse.json({ error: 'Forbidden — only superadmin' }, { status: 403 });
    }

    const supabase = supabaseServer();

    // Pobierz id użytkownika żeby wygenerować anonimowy email
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, status')
        .eq('id', params.id)
        .single();

    if (!profile) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (profile.status === 'anonymized') {
        return NextResponse.json({ error: 'Already anonymized' }, { status: 409 });
    }

    const anonEmail = `deleted_${params.id.slice(-6)}@anon.ebs`;
    const now = new Date().toISOString();

    // 1. Nadpisz dane w user_profiles
    const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
            full_name:    'Użytkownik Zanonimizowany',
            department:   null,
            position:     null,
            phone_number: null,
            iban:         null,
            iban_verified: false,
            pesel:        '***',
            status:       'anonymized',
            anonymized_at: now,
            updated_at:   now,
        })
        .eq('id', params.id);

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

    // 2. Zmień email w auth.users na anonimowy
    const { error: authError } = await supabase.auth.admin.updateUserById(params.id, {
        email: anonEmail,
    });

    if (authError) {
        // Nie przerywaj — dane w user_profiles już zanonimizowane
        console.error('[anonymize] auth email update failed:', authError.message);
    }

    return NextResponse.json({ success: true, anonymizedAt: now });
}
