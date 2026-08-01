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
import { fullName } from '@/lib/hr/docPlaceholders';

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

  // ── SP5: odkup — Faza A (PDF+mail, idempotentne po pdf_url), Faza B (paczki, guard transfer_batched_at) ──
  let buybackEmails = 0;
  let batchesCreated = 0;
  try {
    // Faza A: umowy bez pdf_url → generuj PDF (ustawia pdf_url) + mail. PDF fail → pomiń (retry następnym razem).
    const { data: pendingPdf } = await supabase
      .from('buyback_agreements')
      .select('id, user_id')
      .is('pdf_url', null)
      .eq('status', 'pending_approval')
      .limit(500);
    for (const agr of (pendingPdf ?? []) as any[]) {
      const pdfUrl = await createBuybackAgreementPdf(agr.id);
      if (!pdfUrl) continue; // PDF-serwer padł — nie mailuj, nie paczkuj; ponowimy (pdf_url dalej null)
      const { data: prof } = await supabase.from('user_profiles')
        .select('full_name, contact_email, iban').eq('id', agr.user_id).single();
      const p = (prof as any) ?? {};
      // mail o wypłacie tylko gdy jest na co zapłacić (jest IBAN)
      if (p.contact_email && p.iban) {
        let attachments: { filename: string; content: Buffer }[] | undefined;
        try { const r = await fetch(pdfUrl); if (r.ok) attachments = [{ filename: 'umowa-odkupu.pdf', content: Buffer.from(await r.arrayBuffer()) }]; }
        catch { /* brak załącznika nie blokuje maila */ }
        const res = await sendEmail({
          to: p.contact_email,
          subject: 'EBS — Umowa odkupu voucherów',
          html: `<p>Cześć ${p.full_name ?? ''},</p><p>Twoje vouchery wygasły i zostały objęte odkupem. W załączniku umowa odkupu; wypłata nastąpi przelewem na Twój rachunek w terminie do 7 dni.</p><p>Zespół Stratton Prime</p>`,
          attachments,
        });
        if (res.ok || res.skipped) buybackEmails += 1;
      }
    }
    // Faza B: umowy z pdf_url, jeszcze niezpaczkowane → paczki per firma; oznacz transfer_batched_at PO wstawieniu.
    const { data: toBatch } = await supabase
      .from('buyback_agreements')
      .select('id, user_id, voucher_count, total_value_pln')
      .not('pdf_url', 'is', null)
      .is('transfer_batched_at', null)
      .limit(1000);
    const byCompany = new Map<string, { ids: string[]; items: TransferItem[]; count: number; total: number }>();
    for (const agr of (toBatch ?? []) as any[]) {
      const { data: prof } = await supabase.from('user_profiles')
        .select('full_name, iban, company_id').eq('id', agr.user_id).single();
      const p = (prof as any) ?? {};
      if (!p.company_id || !p.iban) continue; // bez firmy/IBAN nie da się zbudować przelewu — do ręcznej obsługi
      const agg = byCompany.get(p.company_id) ?? { ids: [], items: [], count: 0, total: 0 };
      agg.ids.push(agr.id);
      agg.items.push({ recipientName: p.full_name ?? 'Pracownik', recipientIban: p.iban, amountPln: Number(agr.total_value_pln) || 0, title: `Odkup voucherów EBS ${String(agr.id).slice(-8).toUpperCase()}` });
      agg.count += Number(agr.voucher_count) || 0; agg.total += Number(agr.total_value_pln) || 0;
      byCompany.set(p.company_id, agg);
    }
    const sender = { name: ISSUER.name, iban: ISSUER.bank.replace(/\s+/g, '') };
    const nowB = new Date();
    const periodLabel = nowB.toISOString().slice(0, 7);
    for (const [companyId, agg] of byCompany) {
      await supabase.from('buyback_batches').insert([
        { company_id: companyId, period_label: periodLabel, total_amount: agg.total, voucher_count: agg.count, status: 'generated', format: 'elixir0',    file_csv: buildElixir0(agg.items, sender, nowB) },
        { company_id: companyId, period_label: periodLabel, total_amount: agg.total, voucher_count: agg.count, status: 'generated', format: 'millennium', file_csv: buildMillenniumCsv(agg.items, sender, nowB) },
      ]);
      // oznacz umowy tej firmy jako zpaczkowane NATYCHMIAST po wstawieniu (minimalizuje okno duplikatu)
      await supabase.from('buyback_agreements').update({ transfer_batched_at: new Date().toISOString() }).in('id', agg.ids);
      batchesCreated += 2;
    }
  } catch (e: any) {
    console.error('[cron/expire-vouchers] odkup:', e?.message);
  }

  // E2e: digest wygasania (dawniej osobny cron expiry-alerts w BBS)
  let expiryAlerts = 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const leaseSoon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    const DOC_FIELDS: [string, string][] = [
      ['passport_expiry', 'paszport'],
      ['visa_expiry', 'wiza'],
      ['residence_card_expiry', 'karta pobytu'],
      ['work_permit_expiry', 'pozwolenie na pracę'],
    ];
    const VEH_FIELDS: [string, string][] = [
      ['insurance_until', 'ubezpieczenie OC'],
      ['inspection_until', 'przegląd techniczny'],
      ['license_expiry', 'prawo jazdy'],
    ];

    const [{ data: emps }, { data: accs }, { data: vehicles }] = await Promise.all([
      (supabase as any).from('hr_employees')
        .select('first_name, second_name, last_name, second_last_name, passport_expiry, visa_expiry, residence_card_expiry, work_permit_expiry, tlc, tlc_expiry, contract:hr_contracts(name)')
        .eq('archived', false).eq('candidate', false),
      (supabase as any).from('hr_accommodations')
        .select('name, lease_end_date, hr_employees(count)')
        .not('lease_end_date', 'is', null).lte('lease_end_date', leaseSoon),
      (supabase as any).from('hr_vehicles')
        .select('make, model, registration, insurance_until, inspection_until, license_expiry, main_user_name, driver_name, license_name, contract:hr_contracts(name)')
        .neq('status', 'wycofany'),
    ]);

    const docAlerts: { name: string; contract: string; what: string; date: string; expired: boolean }[] = [];
    for (const e of emps || []) {
      for (const [f, label] of DOC_FIELDS) {
        const v = (e as any)[f];
        if (v && v <= soon) docAlerts.push({ name: fullName(e), contract: (e as any).contract?.name || '—', what: label, date: v, expired: v < today });
      }
      // TLC — karta pobytu wydana przez inny kraj UE (pole warunkowe: tylko gdy tlc=true)
      if ((e as any).tlc && (e as any).tlc_expiry && (e as any).tlc_expiry <= soon) {
        docAlerts.push({ name: fullName(e), contract: (e as any).contract?.name || '—', what: 'TLC — karta pobytu', date: (e as any).tlc_expiry, expired: (e as any).tlc_expiry < today });
      }
    }
    docAlerts.sort((a, b) => a.date.localeCompare(b.date));
    const leaseAlerts = (accs || []).map((a: any) => ({ name: a.name, date: a.lease_end_date, people: a.hr_employees?.[0]?.count ?? 0 }));

    const fleetAlerts: { vehicle: string; contract: string; what: string; date: string; expired: boolean }[] = [];
    for (const v of vehicles || []) {
      const label = [(v as any).make, (v as any).model].filter(Boolean).join(' ') + ((v as any).registration ? ` (${(v as any).registration})` : '');
      for (const [f, what] of VEH_FIELDS) {
        const val = (v as any)[f];
        if (val && val <= soon) {
          const who = what === 'prawo jazdy' ? ` — ${(v as any).license_name || (v as any).main_user_name || (v as any).driver_name || 'kierowca'}` : '';
          fleetAlerts.push({ vehicle: label || '—', contract: (v as any).contract?.name || '—', what: what + who, date: val, expired: val < today });
        }
      }
    }
    fleetAlerts.sort((a, b) => a.date.localeCompare(b.date));

    if (docAlerts.length || leaseAlerts.length || fleetAlerts.length) {
      const { data: profiles } = await supabase.from('user_profiles')
        .select('id, role').in('role', ['superadmin', 'dyrektor', 'szef_koordynatorow']);
      const ids = new Set((profiles ?? []).map((p: any) => p.id));
      const { data: usersPage } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const recipients = (usersPage?.users ?? []).filter((u: any) => ids.has(u.id) && u.email).map((u: any) => u.email as string);

      if (recipients.length) {
        const d = (s: string) => new Date(s).toLocaleDateString('pl-PL');
        const html = `
          <div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
            <h2 style="margin:0 0 12px">⚠️ EBS — dokumenty wymagające uwagi (${d(today)})</h2>
            ${docAlerts.length ? `
              <h3 style="margin:14px 0 6px;font-size:15px">Dokumenty pracowników (wygasłe lub ≤30 dni): ${docAlerts.length}</h3>
              <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;font-size:13px">
                <tr style="background:#f1f3f5"><th align="left">Pracownik</th><th align="left">Kontrakt</th><th align="left">Dokument</th><th align="left">Termin</th></tr>
                ${docAlerts.map(a => `<tr${a.expired ? ' style="background:#fdecec"' : ''}><td>${a.name}</td><td>${a.contract}</td><td>${a.what}</td><td><strong>${d(a.date)}${a.expired ? ' — WYGASŁ' : ''}</strong></td></tr>`).join('')}
              </table>` : ''}
            ${leaseAlerts.length ? `
              <h3 style="margin:14px 0 6px;font-size:15px">Kończące się najmy (≤7 dni): ${leaseAlerts.length}</h3>
              <ul>${leaseAlerts.map((a: any) => `<li><strong>${a.name}</strong> — koniec najmu ${d(a.date)} (mieszka ${a.people} os.)</li>`).join('')}</ul>` : ''}
            ${fleetAlerts.length ? `
              <h3 style="margin:14px 0 6px;font-size:15px">Flota — OC / przegląd / prawo jazdy (wygasłe lub ≤30 dni): ${fleetAlerts.length}</h3>
              <table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;border-color:#ddd;font-size:13px">
                <tr style="background:#f1f3f5"><th align="left">Pojazd</th><th align="left">Projekt</th><th align="left">Co</th><th align="left">Termin</th></tr>
                ${fleetAlerts.map(a => `<tr${a.expired ? ' style="background:#fdecec"' : ''}><td>${a.vehicle}</td><td>${a.contract}</td><td>${a.what}</td><td><strong>${d(a.date)}${a.expired ? ' — WYGASŁ' : ''}</strong></td></tr>`).join('')}
              </table>` : ''}
            <p style="color:#888;font-size:12px;margin-top:16px">Automatyczny raport EBS — szczegóły w panelu: Agencja Pracy → Pracownicy, Baza Noclegowa i Flota.</p>
          </div>`;

        await sendEmail({
          to: recipients,
          subject: `⚠️ EBS: ${docAlerts.length} dokumentów do uwagi${leaseAlerts.length ? ` + ${leaseAlerts.length} najmów` : ''}${fleetAlerts.length ? ` + ${fleetAlerts.length} floty` : ''} — ${d(today)}`,
          html,
        });
        expiryAlerts = docAlerts.length + leaseAlerts.length + fleetAlerts.length;
      }
    }
  } catch (e: any) {
    console.error('[cron/expire-vouchers] digest wygasania:', e?.message);
  }

  return NextResponse.json({
    ok:       true,
    expired,
    buybacks,
    remindersSent,
    buybackEmails,
    batches:  batchesCreated,
    expiryAlerts,
    ran_at:   new Date().toISOString(),
  });
}
