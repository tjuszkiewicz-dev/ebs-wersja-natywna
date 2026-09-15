// POST /api/benefits/inquiry — „Zapytaj o ofertę" dla pozycji z ceną 0 (pracownik).
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §5.5.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthUserWithRole } from '@/lib/apiAuth';
import { supabaseServer } from '@/lib/supabase';
import { sendEmail } from '@/lib/mailer';
import { findCatalogItem } from '@/lib/benefits/catalog';
import { isWithinDedupWindow } from '@/lib/benefits/inquiry';
import { bokInquiryMail, employeeInquiryMail } from '@/lib/benefits/mails';
import { BOK_EMAIL } from '@/lib/benefits/constants';

const Schema = z.object({ serviceId: z.string().min(1).max(100) });

export async function POST(req: NextRequest) {
  const auth = await getAuthUserWithRole();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (auth.role !== 'pracownik') return NextResponse.json({ error: 'Zapytania w sklepie są dostępne tylko dla pracowników.' }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Nieprawidłowe dane.' }, { status: 400 });
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const item = findCatalogItem(parsed.data.serviceId);
  if (!item || !item.isActive) return NextResponse.json({ error: 'Ta pozycja nie istnieje w katalogu.' }, { status: 400 });
  if (item.price !== 0) return NextResponse.json({ error: 'Ta pozycja ma cenę — kup ją za punkty.' }, { status: 400 });

  const db = supabaseServer() as any;
  const { data: last } = await db.from('benefit_inquiries')
    .select('created_at').eq('user_id', auth.id).eq('service_id', item.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (last?.created_at && isWithinDedupWindow(last.created_at)) {
    return NextResponse.json({ error: 'already_reported', reportedAt: last.created_at }, { status: 409 });
  }

  const { data: row, error } = await db.from('benefit_inquiries')
    .insert({ user_id: auth.id, service_id: item.id, service_name: item.name, partner: item.partner ?? null })
    .select('id, created_at').single();
  if (error || !row) {
    console.error('[inquiry] insert failed', error?.message);
    return NextResponse.json({ error: 'Nie udało się zapisać zgłoszenia.' }, { status: 500 });
  }

  const { data: profile } = await db.from('user_profiles').select('full_name, company_id').eq('id', auth.id).single();
  let companyName: string | undefined;
  if (profile?.company_id) {
    const { data: c } = await db.from('companies').select('name').eq('id', profile.company_id).single();
    companyName = c?.name ?? undefined;
  }
  const input = { productName: item.name, partner: item.partner, employeeName: profile?.full_name ?? 'Pracownik', employeeEmail: auth.email, companyName, when: new Date() };

  let mailSkipped = false;
  try {
    const b = bokInquiryMail(input);
    const r1 = await sendEmail({ to: BOK_EMAIL, replyTo: auth.email, subject: b.subject, html: b.html });
    if (!r1.ok) console.error('[inquiry] mail not sent', { to: 'bok', inquiryId: row.id, serviceId: item.id, userId: auth.id, reason: r1.error ?? 'skipped' });
    const e = employeeInquiryMail(input);
    const r2 = await sendEmail({ to: auth.email, subject: e.subject, html: e.html });
    if (!r2.ok) console.error('[inquiry] mail not sent', { to: 'employee', inquiryId: row.id, serviceId: item.id, userId: auth.id, reason: r2.error ?? 'skipped' });
    mailSkipped = !!(r1.skipped || r2.skipped);
  } catch (e: any) {
    console.error('[inquiry] mail failed', e?.message ?? e);
    mailSkipped = true;
  }

  return NextResponse.json({ ok: true, inquiryId: row.id, ...(mailSkipped ? { mailSkipped: true } : {}) });
}
