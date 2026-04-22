// POST /api/users/[id]/reset-password
// Reset user password (admin only - development utility)
// Requires: superadmin role
// Body: { password: string }
// Returns: { ok: boolean, email: string }

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUserWithRole();

  // Only superadmin can reset passwords
  if (!auth || auth.role !== 'superadmin') {
    return NextResponse.json(
      { error: 'Only superadmin can reset passwords' },
      { status: 403 }
    );
  }

  const userId = params.id;
  if (!userId) {
    return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { password } = body;
  if (!password || typeof password !== 'string' || password.length < 1) {
    return NextResponse.json(
      { error: 'Password must be a non-empty string' },
      { status: 400 }
    );
  }

  try {
    const supabase = supabaseServer();

    // Update password via Supabase Admin API
    const { data, error } = await (supabase as any).auth.admin.updateUserById(userId, {
      password,
    });

    if (error) {
      console.error('[reset-password] Supabase error:', error.message);
      return NextResponse.json(
        { error: error.message || 'Failed to reset password' },
        { status: 400 }
      );
    }

    const userEmail = data?.user?.email || 'unknown@example.com';

    console.log(`[reset-password] Password reset for user: ${userId} (${userEmail})`);

    return NextResponse.json({
      ok: true,
      email: userEmail,
      message: `Password reset to "${password}" for ${userEmail}`,
    });
  } catch (e: any) {
    console.error('[reset-password] Exception:', e.message);
    return NextResponse.json(
      { error: 'Internal server error: ' + e.message },
      { status: 500 }
    );
  }
}
