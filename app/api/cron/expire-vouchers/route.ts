// GET /api/cron/expire-vouchers
// Called by Vercel Cron (vercel.json) — runs daily at 23:55 Warsaw time (21:55 UTC winter / 22:55 UTC DST).
// Expires overdue vouchers and auto-creates buyback_agreements per employee.
//
// Security: protected by CRON_SECRET env var.
//   Vercel Cron sends the secret as Authorization: Bearer <CRON_SECRET>.
//   Set CRON_SECRET in Vercel Project Settings → Environment Variables.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // If CRON_SECRET is not configured, block all external requests
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseServer();

  const { data, error } = await supabase.rpc('expire_vouchers_and_create_buybacks');

  if (error) {
    console.error('[cron/expire-vouchers]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  const expired  = result?.expired_count  ?? 0;
  const buybacks = result?.buyback_count  ?? 0;

  console.log(`[cron/expire-vouchers] expired=${expired} buybacks=${buybacks}`);

  return NextResponse.json({
    ok:       true,
    expired,
    buybacks,
    ran_at:   new Date().toISOString(),
  });
}
