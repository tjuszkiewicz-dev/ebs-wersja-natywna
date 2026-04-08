import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';

const ImportRowSchema = z.object({
    name:         z.string(),
    surname:      z.string(),
    email:        z.string().min(1),   // email format validated by Supabase auth itself
    pesel:        z.string().optional(),
    department:   z.string().optional(),
    position:     z.string().optional(),
    phoneNumber:  z.string().optional(),
    iban:         z.string().optional(),
    contractType: z.string().optional(),
});

const BulkImportSchema = z.object({
    validRows: z.array(ImportRowSchema).min(1).max(500),
    companyId: z.string().min(1),
});

// POST /api/users/bulk-import
export async function POST(req: NextRequest) {
    const auth = await getAuthUserWithRole();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['superadmin', 'pracodawca'].includes(auth.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const parsed = BulkImportSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = supabaseServer();
    const now = new Date().toISOString();
    const { validRows, companyId } = parsed.data;

    // Utwórz konta auth + profile dla każdego pracownika
    const createdUsers: { id: string; email: string; tempPassword: string; name: string }[] = [];
    const errors: string[] = [];

    for (const row of validRows) {
        const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!';
        const email = row.email.toLowerCase().trim();

        // Spróbuj utwórzyć konto w auth.users
        let userId: string;
        const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
        });

        if (authError) {
            // Przypadek: użytkownik już istnieje w auth — znajdź go przez user_profiles
            if (
                authError.message?.toLowerCase().includes('already') ||
                authError.message?.toLowerCase().includes('database error creating new user')
            ) {
                // Szybszy lookup przez auth.admin.getUserByEmail lub user_profiles
                // Spróbuj najpierw przez auth admin listUsers z filtrem
                const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
                const existing = listData?.users?.find(u => u.email?.toLowerCase() === email);
                if (existing) {
                    userId = existing.id;
                } else {
                    // Ostateczny fallback: sprawdź user_profiles po emailu (jeśli kolumna istnieje)
                    errors.push(`${email}: już istnieje, ale nie znaleziono profilu`);
                    continue;
                }
            } else {
                errors.push(`${email}: ${authError.message}`);
                continue;
            }
        } else if (!newUser.user) {
            errors.push(`${email}: no user returned`);
            continue;
        } else {
            userId = newUser.user.id;
        }

        const rawIban = row.iban ? row.iban.replace(/\s+/g, '').toUpperCase() : null;
        const isUZ = row.contractType?.toUpperCase().includes('UZ') || row.contractType?.includes('ZLECENIE');

        // Utwórz lub zaktualizuj profil (upsert)
        const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
                id:            userId,
                role:          'pracownik',
                full_name:     `${row.name} ${row.surname}`,
                company_id:    companyId,
                department:    row.department ?? null,
                position:      row.position ?? null,
                phone_number:  row.phoneNumber ?? null,
                pesel:         row.pesel ?? null,
                iban:          rawIban,
                iban_verified: !!rawIban,
                iban_verified_at: rawIban ? now : null,
                contract_type: isUZ ? 'UZ' : 'UOP',
                status:        'active',
                terms_accepted: true,
                terms_accepted_at: now,
                temp_password: tempPassword,
            }, { onConflict: 'id' });

        if (profileError) {

            errors.push(`${email}: profile error — ${profileError.message}`);
            continue;
        }

        createdUsers.push({ id: userId, email, tempPassword, name: `${row.name} ${row.surname}` });
    }

    // Zapisz historię importu
    const reportId = `REP-${Date.now()}`;
    await supabase.from('import_history').insert({
        id:              reportId,
        company_id:      companyId,
        hr_name:         auth.email,
        total_processed: createdUsers.length,
        status:          errors.length === 0 ? 'SUCCESS' : createdUsers.length > 0 ? 'PARTIAL' : 'ERROR',
        report_data: {
            reportId,
            date:          now,
            importedCount: createdUsers.length,
            errors,
            users:         createdUsers.map(u => ({ id: u.id, email: u.email, name: u.name, tempPassword: u.tempPassword })),
        },
    });

    return NextResponse.json({
        imported: createdUsers.length,
        errors,
        reportId,
        users: createdUsers.map(u => ({ id: u.id, email: u.email, name: u.name, tempPassword: u.tempPassword })),
    }, { status: 201 });
}
