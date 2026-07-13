import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { z } from 'zod';
import { normalizeIBAN } from '@/lib/iban';

const ImportRowSchema = z.object({
    name:         z.string(),
    surname:      z.string(),
    email:        z.string().min(1),   // email format validated by Supabase auth itself
    pesel:        z.string().optional(),
    department:   z.string().optional(),
    position:     z.string().optional(),
    phoneNumber:  z.string().optional(),
    iban:         z.string().optional(),
    street:       z.string().optional(),
    zipCode:      z.string().optional(),
    city:         z.string().optional(),
    hireDate:     z.string().optional(),
    contractType: z.string().optional(),
});

const BulkImportSchema = z.object({
    validRows: z.array(ImportRowSchema).min(1).max(500),
    companyId: z.string().min(1),
});

const norm = (s?: string | null) => (s ?? '').trim().toLowerCase();
const normPesel = (s?: string | null) => (s ?? '').replace(/\D/g, '');

/**
 * Buduje unikalny e-mail logowania (alias) dla kolejnego rekordu tej samej osoby
 * w innej firmie. Prawdziwy e-mail (kontaktowy) trzymamy osobno w contact_email.
 * Alias osadza skrót company_id, więc jest deterministyczny i unikalny per firma.
 */
function buildLoginAlias(realEmail: string, companyId: string, taken: Set<string>): string {
    const [localRaw, domainRaw] = realEmail.split('@');
    const local = localRaw || 'user';
    const domain = domainRaw || 'ebs.local';
    const tag = companyId.replace(/-/g, '').slice(0, 8);
    let candidate = `${local}+c${tag}@${domain}`.toLowerCase();
    let n = 2;
    while (taken.has(candidate)) {
        candidate = `${local}+c${tag}-${n}@${domain}`.toLowerCase();
        n++;
    }
    return candidate;
}

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

    const supabase = supabaseServer() as any;
    const now = new Date().toISOString();
    const { validRows, companyId } = parsed.data;

    // Pobierz WSZYSTKICH istniejących użytkowników auth (paginacja) — żeby wiedzieć
    // które adresy są już zajęte globalnie (auth.users.email jest unikalny globalnie).
    const allAuthUsers: any[] = [];
    let authPage = 1;
    while (true) {
        const { data: authListData } = await supabase.auth.admin.listUsers({ perPage: 1000, page: authPage });
        const pageUsers = authListData?.users ?? [];
        allAuthUsers.push(...pageUsers);
        if (pageUsers.length < 1000) break; // last page reached
        authPage++;
    }
    const authEmailToId = new Map<string, string>(
        allAuthUsers.map((u: any) => [norm(u.email), u.id as string])
    );
    const authIdToEmail = new Map<string, string>(
        allAuthUsers.map((u: any) => [u.id as string, norm(u.email)])
    );
    const takenAuthEmails = new Set<string>([...authEmailToId.keys()].filter(Boolean));

    // Pobierz istniejących pracowników TEJ firmy — deduplikacja jest ograniczona
    // do jednej firmy (PESEL w obrębie firmy; pomocniczo e-mail kontaktowy).
    // To kluczowa zmiana: NIE dopasowujemy globalnie po e-mailu i NIGDY nie
    // nadpisujemy company_id rekordu należącego do innej firmy.
    const { data: companyProfiles } = await supabase
        .from('user_profiles')
        .select('id, pesel, contact_email')
        .eq('company_id', companyId)
        .eq('role', 'pracownik');

    const peselToId = new Map<string, string>();
    const emailToIdInCompany = new Map<string, string>();
    for (const p of companyProfiles ?? []) {
        const ip = normPesel(p.pesel);
        if (ip) peselToId.set(ip, p.id);
        const realEmail = norm(p.contact_email) || authIdToEmail.get(p.id) || '';
        if (realEmail) emailToIdInCompany.set(realEmail, p.id);
    }

    // Utwórz/zaktualizuj rekordy pracowników DLA TEJ FIRMY
    const createdUsers: { id: string; email: string; loginEmail: string; tempPassword: string; name: string }[] = [];
    const errors: string[] = [];

    for (const row of validRows) {
        const tempPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase() + '!';
        const realEmail = norm(row.email);
        const pesel = normPesel(row.pesel);
        const street = row.street?.trim() ?? '';
        const zipCode = row.zipCode?.trim() ?? '';
        const city = row.city?.trim() ?? '';

        // 1) Czy ta osoba już istnieje W TEJ FIRMIE? (PESEL > e-mail kontaktowy)
        let userId: string | undefined;
        if (pesel && peselToId.has(pesel)) {
            userId = peselToId.get(pesel);
        } else if (realEmail && emailToIdInCompany.has(realEmail)) {
            userId = emailToIdInCompany.get(realEmail);
        }

        let loginEmail: string;

        if (userId) {
            // Aktualizacja istniejącego pracownika tej firmy — resetujemy hasło.
            loginEmail = authIdToEmail.get(userId) || realEmail;
            await supabase.auth.admin.updateUserById(userId, {
                password: tempPassword,
                email_confirm: true,
            });
        } else {
            // 2) Nowy rekord dla tej firmy. Login = prawdziwy e-mail, jeśli wolny;
            //    w przeciwnym razie alias (np. ta sama osoba pracuje już w innej firmie).
            loginEmail = (realEmail && !takenAuthEmails.has(realEmail))
                ? realEmail
                : buildLoginAlias(realEmail || `${pesel || 'user'}@ebs.local`, companyId, takenAuthEmails);

            const { data: newUser, error: authError } = await supabase.auth.admin.createUser({
                email: loginEmail,
                password: tempPassword,
                email_confirm: true,
            });
            if (authError || !newUser?.user) {
                console.error(`[bulk-import] createUser error for ${loginEmail}:`, authError?.message ?? 'no user returned');
                errors.push(`${realEmail || loginEmail}: ${authError?.message ?? 'no user returned'}`);
                continue;
            }
            userId = newUser.user.id;
            takenAuthEmails.add(loginEmail);
            authIdToEmail.set(userId, loginEmail);
        }

        const rawIban = row.iban ? normalizeIBAN(row.iban) : null;
        const isUZ = row.contractType?.toUpperCase().includes('UZ') || row.contractType?.includes('ZLECENIE');

        // Upewnij się, że hire_date jest w formacie YYYY-MM-DD lub null
        const hireDateRaw = row.hireDate?.trim() ?? '';
        const hireDate = /^\d{4}-\d{2}-\d{2}$/.test(hireDateRaw) ? hireDateRaw : null;

        // Zaszyfruj PESEL jeśli podany
        let peselEncrypted: string | null = null;
        if (row.pesel) {
            const peselKey = process.env.EBS_PESEL_KEY;
            if (peselKey) {
                const { data: enc } = await supabase.rpc('encrypt_pesel', {
                    p_pesel: row.pesel,
                    p_key:   peselKey,
                });
                peselEncrypted = enc ?? null;
            }
        }

        // Utwórz lub zaktualizuj profil (upsert po id) — company_id zawsze = bieżąca firma.
        const { error: profileError } = await supabase
            .from('user_profiles')
            .upsert({
                id:              userId,
                role:            'pracownik',
                full_name:       `${row.name} ${row.surname}`,
                company_id:      companyId,
                contact_email:   realEmail || null,
                department:      row.department ?? null,
                position:        row.position ?? null,
                phone_number:    row.phoneNumber ?? null,
                pesel:           row.pesel ?? null,
                pesel_encrypted: peselEncrypted,
                address_street:  street || null,
                address_zip:     zipCode || null,
                address_city:    city || null,
                iban:          rawIban,
                iban_verified: false,
                iban_verified_at: null,
                contract_type: isUZ ? 'UZ' : 'UOP',
                hire_date:     hireDate,
                status:        'active',
                terms_accepted: true,
                terms_accepted_at: now,
            }, { onConflict: 'id' });

        if (profileError) {
            console.error(`[bulk-import] profile upsert error for ${loginEmail}:`, profileError.message);
            errors.push(`${realEmail || loginEmail}: profile error — ${profileError.message}`);
            continue;
        }

        // Zapisz hasło tymczasowe oddzielnie
        await supabase
            .from('user_profiles')
            .update({ temp_password: tempPassword })
            .eq('id', userId);

        // Zaktualizuj mapy deduplikacji, żeby kolejne wiersze w tym samym pliku
        // nie utworzyły duplikatu tej samej osoby w tej firmie.
        if (pesel) peselToId.set(pesel, userId!);
        if (realEmail) emailToIdInCompany.set(realEmail, userId!);

        createdUsers.push({ id: userId!, email: realEmail, loginEmail, tempPassword, name: `${row.name} ${row.surname}` });
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
            users:         createdUsers.map(u => ({ id: u.id, email: u.email, loginEmail: u.loginEmail, name: u.name, tempPassword: u.tempPassword })),
        },
    });

    return NextResponse.json({
        imported: createdUsers.length,
        errors,
        reportId,
        users: createdUsers.map(u => ({ id: u.id, email: u.email, loginEmail: u.loginEmail, name: u.name, tempPassword: u.tempPassword })),
    }, { status: 201 });
}
