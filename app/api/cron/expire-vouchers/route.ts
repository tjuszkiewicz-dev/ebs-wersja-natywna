// GET /api/cron/expire-vouchers
// Called by Vercel Cron (vercel.json) — runs daily at 23:55 Warsaw time (21:55 UTC winter / 22:55 UTC DST).
// Expires overdue vouchers and auto-creates buyback_agreements per employee.
//
// Security: protected by CRON_SECRET env var.
//   Vercel Cron sends the secret as Authorization: Bearer <CRON_SECRET>.
//   Set CRON_SECRET in Vercel Project Settings → Environment Variables.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { sendEmail } from '@/lib/mailer';
import { groupExpiringByOwner } from '@/lib/vouchers/expiryReminders';
import { buildElixir0, type TransferItem } from '@/lib/bank/elixir0';
import { buildMillenniumCsv } from '@/lib/bank/millenniumCsv';
import { createBuybackAgreementPdf } from '@/lib/documents/buybackAgreementService';
import { ISSUER } from '@/lib/documents/pdfUtils';

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

  const supabase = supabaseServer() as any;

  // ── SP4: przypomnienia „vouchery wygasają jutro" (mail + in-app), idempotentnie ──
  let remindersSent = 0;
  try {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
    const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2, 0, 0, 0));
    const { data: expiring } = await supabase
      .from('vouchers')
      .select('id, current_owner_id, valid_until')
      .eq('status', 'distributed')
      .gte('valid_until', start.toISOString())
      .lt('valid_until', end.toISOString())
      .is('expiry_reminder_at', null);
    const rows = (expiring ?? []) as { id: string; current_owner_id: string }[];
    if (rows.length) {
      const ownerIds = [...new Set(rows.map(r => r.current_owner_id))];
      const { data: profs } = await supabase.from('user_profiles')
        .select('id, full_name, contact_email').in('id', ownerIds);
      const profById = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
      const grouped = groupExpiringByOwner(rows.map(r => ({
        current_owner_id: r.current_owner_id,
        owner_email: profById.get(r.current_owner_id)?.contact_email ?? null,
        owner_name:  profById.get(r.current_owner_id)?.full_name ?? null,
      })));
      for (const [ownerId, info] of grouped) {
        await supabase.from('notifications').insert({
          user_id: ownerId,
          message: `Twoje vouchery (${info.count} szt.) wygasają jutro. Odnów je w aplikacji, aby nie utracić środków.`,
          type: 'WARNING',
        });
        if (info.email) {
          await sendEmail({
            to: info.email,
            subject: 'EBS — Twoje vouchery wygasają jutro',
            html: `<p>Cześć ${info.name ?? ''},</p><p>Twoje vouchery (<b>${info.count} szt.</b>) wygasają jutro. Zaloguj się do aplikacji EBS i odnów ich ważność, aby nie utracić środków.</p><p>Zespół Stratton Prime</p>`,
          });
        }
        remindersSent += info.count;
      }
      await supabase.from('vouchers').update({ expiry_reminder_at: new Date().toISOString() }).in('id', rows.map(r => r.id));
    }
  } catch (e: any) {
    console.error('[cron/expire-vouchers] przypomnienia:', e?.message);
  }

  const { data, error } = await supabase.rpc('expire_vouchers_and_create_buybacks');

  if (error) {
    console.error('[cron/expire-vouchers]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result = Array.isArray(data) ? data[0] : data;
  const expired  = result?.expired_count  ?? 0;
  const buybacks = result?.buyback_count  ?? 0;

  console.log(`[cron/expire-vouchers] expired=${expired} buybacks=${buybacks}`);

  // ── SP5: nowe umowy odkupu (bez pdf_url) — PDF + mail do pracownika + paczki per firma ──
  let buybackEmails = 0;
  type Agg = { items: TransferItem[]; count: number; total: number };
  const byCompany = new Map<string, Agg>();
  try {
    const { data: newAgr } = await supabase
      .from('buyback_agreements')
      .select('id, user_id, voucher_count, total_value_pln')
      .is('pdf_url', null)
      .eq('status', 'pending_approval')
      .limit(500);
    for (const agr of (newAgr ?? []) as any[]) {
      const pdfUrl = await createBuybackAgreementPdf(agr.id);
      const { data: prof } = await supabase.from('user_profiles')
        .select('full_name, contact_email, iban, company_id').eq('id', agr.user_id).single();
      const p = (prof as any) ?? {};
      const amount = Number(agr.total_value_pln) || 0;
      const vcount = Number(agr.voucher_count) || 0;
      if (p.company_id && p.iban) {
        const agg = byCompany.get(p.company_id) ?? { items: [], count: 0, total: 0 };
        agg.items.push({ recipientName: p.full_name ?? 'Pracownik', recipientIban: p.iban, amountPln: amount, title: `Odkup voucherów EBS ${String(agr.id).slice(-8).toUpperCase()}` });
        agg.count += vcount; agg.total += amount;
        byCompany.set(p.company_id, agg);
      }
      if (p.contact_email) {
        let attachments: { filename: string; content: Buffer }[] | undefined;
        if (pdfUrl) {
          try { const r = await fetch(pdfUrl); if (r.ok) attachments = [{ filename: 'umowa-odkupu.pdf', content: Buffer.from(await r.arrayBuffer()) }]; }
          catch { /* brak załącznika nie blokuje maila */ }
        }
        const res = await sendEmail({
          to: p.contact_email,
          subject: 'EBS — Umowa odkupu voucherów',
          html: `<p>Cześć ${p.full_name ?? ''},</p><p>Twoje vouchery wygasły i zostały objęte odkupem. W załączniku umowa odkupu; wypłata nastąpi przelewem na Twój rachunek w terminie do 7 dni.</p><p>Zespół Stratton Prime</p>`,
          attachments,
        });
        if (res.ok || res.skipped) buybackEmails += 1;
      }
    }
    const sender = { name: ISSUER.name, iban: ISSUER.bank.replace(/\s+/g, '') };
    const nowB = new Date();
    const periodLabel = nowB.toISOString().slice(0, 7);
    for (const [companyId, agg] of byCompany) {
      await supabase.from('buyback_batches').insert([
        { company_id: companyId, period_label: periodLabel, total_amount: agg.total, voucher_count: agg.count, status: 'generated', format: 'elixir0',    file_csv: buildElixir0(agg.items, sender, nowB) },
        { company_id: companyId, period_label: periodLabel, total_amount: agg.total, voucher_count: agg.count, status: 'generated', format: 'millennium', file_csv: buildMillenniumCsv(agg.items, sender, nowB) },
      ]);
    }
  } catch (e: any) {
    console.error('[cron/expire-vouchers] odkup:', e?.message);
  }

  return NextResponse.json({
    ok:       true,
    expired,
    buybacks,
    remindersSent,
    buybackEmails,
    batches:  byCompany.size * 2,
    ran_at:   new Date().toISOString(),
  });
}
