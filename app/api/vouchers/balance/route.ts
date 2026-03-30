// GET /api/vouchers/balance?userId=UUID
import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { getVoucherBalance } from '@/lib/vouchers';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = req.nextUrl.searchParams.get('userId') ?? auth.id;
  if (userId !== auth.id && auth.role !== 'superadmin')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const result = await getVoucherBalance(userId);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
  return NextResponse.json({ balance: result.data });
}
