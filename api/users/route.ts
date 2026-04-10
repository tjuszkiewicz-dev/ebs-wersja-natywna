import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

// GET /api/users — pobierz użytkowników (superadmin: wszyscy lub per firma, HR: tylko swojej firmy)
export async function GET(req: NextRequest) {
    const auth = await getAuthUserWithRole();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!['superadmin', 'pracodawca'].includes(auth.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = supabaseServer();
    const companyId = req.nextUrl.searchParams.get('companyId');

    let profilesQuery = supabase
        .from('user_profiles')
        .select('*, temp_password')
        .order('created_at', { ascending: false });

    if (companyId) {
        profilesQuery = profilesQuery.eq('company_id', companyId);
    }

    const [profilesResult, authUsersResult, balancesResult] = await Promise.all([
        profilesQuery,
        supabase.auth.admin.listUsers({ perPage: 1000 }),
        supabase.from('voucher_accounts').select('user_id, balance'),
    ]);

    if (profilesResult.error) {
        return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
    }

    const emailMap = new Map(
        (authUsersResult.data?.users ?? []).map(u => [u.id, u.email ?? ''])
    );

    // Saldo voucherów z tabeli voucher_accounts (utrzymywanej przez mint_vouchers/transfer_vouchers)
    const balanceMap = new Map<string, number>();
    for (const va of balancesResult.data ?? []) {
        if (va.user_id) {
            balanceMap.set(va.user_id, va.balance ?? 0);
        }
    }

    const withEmails = (profilesResult.data ?? []).map(p => ({
        ...p,
        email: emailMap.get(p.id) ?? '',
        voucherBalance: balanceMap.get(p.id) ?? 0,
        tempPassword: p.temp_password ?? null,
    }));

    return NextResponse.json(withEmails);
}
