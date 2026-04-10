// GET /api/vouchers/transactions?userId=UUID&limit=50 — historia transakcji (ledger)

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { getTransactionHistory } from '@/lib/vouchers';

export async function GET(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const userId = searchParams.get('userId') ?? auth.id;
  const limit  = Number(searchParams.get('limit') ?? '50');

  if (userId !== auth.id && auth.role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const result = await getTransactionHistory(userId, limit);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  return NextResponse.json(result.data ?? []);
}
