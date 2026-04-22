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
        .select('*, company:companies(id, name)')
        .order('created_at', { ascending: false });

    if (companyId) {
        profilesQuery = profilesQuery.eq('company_id', companyId);
    }

    const [profilesResult, authUsersResult] = await Promise.all([
        profilesQuery,
        supabase.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    if (profilesResult.error) {
        return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
    }

    const emailMap = new Map(
        (authUsersResult.data?.users ?? []).map(u => [u.id, u.email ?? ''])
    );

    const withEmails = (profilesResult.data ?? []).map(p => ({
        ...p,
        email: emailMap.get(p.id) ?? '',
        company_name: (p.company as any)?.name ?? null,
    }));

    return NextResponse.json(withEmails);
}
