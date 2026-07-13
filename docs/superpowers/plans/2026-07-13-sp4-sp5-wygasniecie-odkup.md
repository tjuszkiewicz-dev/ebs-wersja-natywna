# SP4 + SP5 — Przypomnienia o wygaśnięciu + odkup (mail + Elixir-0/Millennium) — Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development lub superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** (SP4) 1 dzień przed wygaśnięciem voucherów pracownik dostaje e-mail + powiadomienie in-app. (SP5) po wygaśnięciu bez odnowienia system generuje PDF umowy odkupu (SP3), wysyła go mailem do pracownika i buduje paczki przelewów **Elixir-0 (KIR)** oraz **Millennium CSV** do pobrania. Wszystko doklejone do istniejącego dziennego crona `expire-vouchers` (limit cron Vercel Hobby = 2, bez nowego).

**Architecture:** Wspólny `lib/mailer.ts` (Resend, graceful bez klucza). SP4: kolumna-guard `vouchers.expiry_reminder_at`; pure helper `lib/vouchers/expiryReminders.groupExpiringByOwner`; cron wysyła przypomnienia „na jutro" przed RPC. SP5: pure generatory `lib/bank/elixir0.ts` + `lib/bank/millenniumCsv.ts`; po RPC cron pobiera nowe `buyback_agreements`, dla każdego generuje PDF (`createBuybackAgreementPdf`) + mail z załącznikiem, składa paczki i zapisuje w `buyback_batches`.

**Tech Stack:** Next.js 15, Supabase, TypeScript, Vitest, Zod, Resend, Puppeteer PDF-serwer.

## Global Constraints

- **Bez nowego crona** — całość w `app/api/cron/expire-vouchers/route.ts` (Vercel Hobby: max 2 crony, już mamy 2).
- **Mailer graceful:** brak `RESEND_API_KEY` → `sendEmail` loguje i zwraca `{ ok:false, skipped:true }` (NIE rzuca; cron działa dalej). Nadawca z env `RESEND_FROM_EMAIL` (domyślnie `EBS Stratton Prime <no-reply@stratton-prime.pl>` — domenę potwierdza użytkownik w Resend).
- **Idempotencja:** przypomnienie tylko raz na vouchera (`expiry_reminder_at IS NULL` → ustaw po wysłce). Odkup: PDF/mail/pozycja paczki tylko dla `buyback_agreements` z `pdf_url IS NULL` (po wygenerowaniu `pdf_url` jest ustawiony → nie powtórzy).
- **Bezpieczeństwo:** żaden przelew nie jest wykonywany — generujemy tylko pliki do ręcznego wgrania w banku.
- **Elixir-0:** kwoty w groszach; **kodowanie Windows-1250**; struktura wg KIR (rekord `110`). **UWAGA:** format bankowo-specyficzny — przed pierwszym realnym użyciem zweryfikować testowym importem w Millennium (nota w nagłówku pliku serwisu).
- Testy przez `npx vitest run`; rdzenie (`mailer` graceful, `groupExpiringByOwner`, `elixir0`, `millenniumCsv`) testowane jednostkowo; cron/migracja = `tsc`+`build`+weryfikacja manualna.
- `npx tsc --noEmit` = 0; `npm run build` = sukces.

---

### Task 1: `lib/mailer.ts` (Resend, graceful) + test

**Files:**
- Create: `lib/mailer.ts`
- Test: `lib/mailer.test.ts`

**Interfaces:**
- Produces: `sendEmail(input: { to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }): Promise<{ ok: boolean; skipped?: boolean; error?: string }>`; `FROM_EMAIL` (const z env).

- [ ] **Step 1: test `lib/mailer.test.ts`**
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sendEmail } from './mailer';

describe('sendEmail (graceful bez klucza)', () => {
  beforeEach(() => { delete process.env.RESEND_API_KEY; });
  it('zwraca skipped gdy brak RESEND_API_KEY (nie rzuca)', async () => {
    const res = await sendEmail({ to: 'a@b.pl', subject: 'x', html: '<p>x</p>' });
    expect(res.ok).toBe(false);
    expect(res.skipped).toBe(true);
  });
});
```
- [ ] **Step 2: run — FAIL**
- [ ] **Step 3: implement `lib/mailer.ts`**
```ts
import { Resend } from 'resend';

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'EBS Stratton Prime <no-reply@stratton-prime.pl>';

export async function sendEmail(input: {
  to: string; subject: string; html: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[mailer] RESEND_API_KEY nieustawiony — pomijam wysyłkę do', input.to, '|', input.subject);
    return { ok: false, skipped: true };
  }
  try {
    const resend = new Resend(key);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL, to: input.to, subject: input.subject, html: input.html,
      attachments: input.attachments?.map(a => ({ filename: a.filename, content: a.content })),
    });
    if (error) { console.error('[mailer] błąd Resend:', error); return { ok: false, error: String(error) }; }
    return { ok: true };
  } catch (e: any) {
    console.error('[mailer] wyjątek:', e?.message); return { ok: false, error: e?.message };
  }
}
```
- [ ] **Step 4: run — PASS**
- [ ] **Step 5: commit** `git add lib/mailer.ts lib/mailer.test.ts && git commit -m "feat(mailer): wspoldzielona wysylka Resend (graceful bez klucza) + test"`

---

### Task 2: Migracja `042` — `vouchers.expiry_reminder_at`

**Files:** Create `supabase/migrations/042_voucher_expiry_reminder.sql`

- [ ] **Step 1: plik**
```sql
-- 042: guard idempotencji przypomnienia o wygaśnięciu vouchera (SP4)
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS expiry_reminder_at TIMESTAMPTZ;
```
- [ ] **Step 2: apply** przez Supabase MCP `apply_migration` (name `voucher_expiry_reminder`, project `ramedybmybcpqvelsmxd`).
- [ ] **Step 3: verify** `SELECT column_name FROM information_schema.columns WHERE table_name='vouchers' AND column_name='expiry_reminder_at';` → 1 wiersz.
- [ ] **Step 4: commit** `git add supabase/migrations/042_voucher_expiry_reminder.sql && git commit -m "feat(db): 042 vouchers.expiry_reminder_at (guard przypomnienia)"`

---

### Task 3: Pure helper grupowania + test

**Files:**
- Create: `lib/vouchers/expiryReminders.ts`
- Test: `lib/vouchers/expiryReminders.test.ts`

**Interfaces:**
- Produces: `groupExpiringByOwner(rows: { current_owner_id: string; owner_email: string | null; owner_name: string | null }[]): Map<string, { email: string | null; name: string | null; count: number }>` — agreguje liczbę voucherów per właściciel.

- [ ] **Step 1: test**
```ts
import { describe, it, expect } from 'vitest';
import { groupExpiringByOwner } from './expiryReminders';

describe('groupExpiringByOwner', () => {
  it('agreguje po właścicielu i liczy sztuki', () => {
    const m = groupExpiringByOwner([
      { current_owner_id: 'u1', owner_email: 'a@x.pl', owner_name: 'A' },
      { current_owner_id: 'u1', owner_email: 'a@x.pl', owner_name: 'A' },
      { current_owner_id: 'u2', owner_email: null, owner_name: 'B' },
    ]);
    expect(m.get('u1')).toEqual({ email: 'a@x.pl', name: 'A', count: 2 });
    expect(m.get('u2')?.count).toBe(1);
    expect(m.size).toBe(2);
  });
});
```
- [ ] **Step 2: run — FAIL**
- [ ] **Step 3: implement**
```ts
/** Agreguje wygasające vouchery po właścicielu (liczba sztuk + kontakt). */
export function groupExpiringByOwner(
  rows: { current_owner_id: string; owner_email: string | null; owner_name: string | null }[],
): Map<string, { email: string | null; name: string | null; count: number }> {
  const m = new Map<string, { email: string | null; name: string | null; count: number }>();
  for (const r of rows) {
    const cur = m.get(r.current_owner_id);
    if (cur) cur.count += 1;
    else m.set(r.current_owner_id, { email: r.owner_email, name: r.owner_name, count: 1 });
  }
  return m;
}
```
- [ ] **Step 4: run — PASS**
- [ ] **Step 5: commit** `git add lib/vouchers/expiryReminders.ts lib/vouchers/expiryReminders.test.ts && git commit -m "feat(vouchers): groupExpiringByOwner + test"`

---

### Task 4: Generator Elixir-0 (KIR) + test

**Files:**
- Create: `lib/bank/elixir0.ts`
- Test: `lib/bank/elixir0.test.ts`

**Interfaces:**
- Produces: `buildElixir0(items: TransferItem[], sender: SenderInfo, date: Date): string` gdzie `TransferItem = { recipientName: string; recipientIban: string; amountPln: number; title: string }`, `SenderInfo = { name: string; iban: string }`. Rekord typu 110 per przelew; kwoty w groszach; data `YYYYMMDD`.

- [ ] **Step 1: test**
```ts
import { describe, it, expect } from 'vitest';
import { buildElixir0 } from './elixir0';

describe('buildElixir0', () => {
  const sender = { name: 'Stratton Prime Sp. z o.o.', iban: 'PL66116022020000000666194064' };
  it('buduje rekord 110 z kwotą w groszach i datą YYYYMMDD', () => {
    const out = buildElixir0(
      [{ recipientName: 'Jan Kowalski', recipientIban: 'PL61109010140000071219812874', amountPln: 12.50, title: 'Odkup EBS' }],
      sender, new Date('2026-07-13T00:00:00Z'),
    );
    const line = out.trim().split('\n')[0];
    expect(line.startsWith('110,20260713,1250,')).toBe(true);   // typ 110, data, 12.50 zł = 1250 gr
    expect(line).toContain('"Jan Kowalski"');
    expect(line).toContain('61109010140000071219812874');        // IBAN bez PL w polu konta
    expect(line).toContain('"Odkup EBS"');
  });
  it('pusta lista → pusty string', () => {
    expect(buildElixir0([], sender, new Date())).toBe('');
  });
});
```
- [ ] **Step 2: run — FAIL**
- [ ] **Step 3: implement `lib/bank/elixir0.ts`**
```ts
// Generator Elixir-0 (KIR) — krajowe przelewy uznaniowe (rekord typu 110).
// UWAGA: format bankowo-specyficzny. Kwoty w groszach, data YYYYMMDD, kodowanie docelowe Windows-1250.
// Przed pierwszym realnym użyciem ZWERYFIKOWAĆ testowym importem w banku (Millennium).
export interface TransferItem { recipientName: string; recipientIban: string; amountPln: number; title: string; }
export interface SenderInfo { name: string; iban: string; }

const nrb = (iban: string) => iban.replace(/\s+/g, '').toUpperCase().replace(/^PL/, '');
const q = (s: string) => `"${(s || '').replace(/"/g, "'").slice(0, 140)}"`;
const bankId = (iban: string) => nrb(iban).slice(0, 8); // 8 cyfr rozliczeniowych z NRB
const yyyymmdd = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;

export function buildElixir0(items: TransferItem[], sender: SenderInfo, date: Date): string {
  if (!items.length) return '';
  const dateStr = yyyymmdd(date);
  const senderNrb = nrb(sender.iban);
  const senderBank = bankId(sender.iban);
  return items.map(it => {
    const grosze = Math.round((Number(it.amountPln) || 0) * 100);
    const recNrb = nrb(it.recipientIban);
    return [
      '110', dateStr, String(grosze), '0', senderBank, '""',
      senderNrb, recNrb, q(sender.name), q(it.recipientName),
      bankId(it.recipientIban), '0', q(it.title), '""', '""', '51', '""',
    ].join(',');
  }).join('\r\n') + '\r\n';
}
```
- [ ] **Step 4: run — PASS**
- [ ] **Step 5: commit** `git add lib/bank/elixir0.ts lib/bank/elixir0.test.ts && git commit -m "feat(bank): generator Elixir-0 (KIR, rekord 110) + test"`

---

### Task 5: Generator Millennium CSV + test

**Files:**
- Create: `lib/bank/millenniumCsv.ts`
- Test: `lib/bank/millenniumCsv.test.ts`

**Interfaces:**
- Consumes: typy `TransferItem`, `SenderInfo` z `./elixir0`.
- Produces: `buildMillenniumCsv(items: TransferItem[], sender: SenderInfo, date: Date): string` — CSV (średnik), nagłówek + wiersze: `Data;Rachunek nadawcy;Rachunek odbiorcy;Nazwa odbiorcy;Kwota;Tytuł`.

- [ ] **Step 1: test**
```ts
import { describe, it, expect } from 'vitest';
import { buildMillenniumCsv } from './millenniumCsv';

describe('buildMillenniumCsv', () => {
  const sender = { name: 'Stratton', iban: 'PL66116022020000000666194064' };
  it('nagłówek + wiersz z kwotą 12,50', () => {
    const out = buildMillenniumCsv(
      [{ recipientName: 'Jan Kowalski', recipientIban: 'PL61109010140000071219812874', amountPln: 12.5, title: 'Odkup EBS' }],
      sender, new Date('2026-07-13T00:00:00Z'),
    );
    const [head, row] = out.trim().split('\n');
    expect(head).toBe('Data;Rachunek nadawcy;Rachunek odbiorcy;Nazwa odbiorcy;Kwota;Tytuł');
    expect(row).toContain('2026-07-13;PL66116022020000000666194064;PL61109010140000071219812874;Jan Kowalski;12,50;Odkup EBS');
  });
});
```
- [ ] **Step 2: run — FAIL**
- [ ] **Step 3: implement `lib/bank/millenniumCsv.ts`**
```ts
import type { TransferItem, SenderInfo } from './elixir0';

const iso = (d: Date) => d.toISOString().slice(0, 10);
const clean = (s: string) => (s || '').replace(/[;\r\n]/g, ' ').trim();
const amt = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',');

/** Prosty CSV importu przelewów Millennium (średnik). */
export function buildMillenniumCsv(items: TransferItem[], sender: SenderInfo, date: Date): string {
  const head = 'Data;Rachunek nadawcy;Rachunek odbiorcy;Nazwa odbiorcy;Kwota;Tytuł';
  const rows = items.map(it =>
    [iso(date), sender.iban.replace(/\s+/g, ''), it.recipientIban.replace(/\s+/g, ''), clean(it.recipientName), amt(it.amountPln), clean(it.title)].join(';'),
  );
  return [head, ...rows].join('\r\n') + '\r\n';
}
```
- [ ] **Step 4: run — PASS**
- [ ] **Step 5: commit** `git add lib/bank/millenniumCsv.ts lib/bank/millenniumCsv.test.ts && git commit -m "feat(bank): generator Millennium CSV + test"`

---

### Task 6: Cron — przypomnienia (SP4) + przetwarzanie odkupów (SP5)

**Files:**
- Modify: `app/api/cron/expire-vouchers/route.ts`

**Interfaces:**
- Consumes: `sendEmail` (T1), `groupExpiringByOwner` (T3), `buildElixir0`/`buildMillenniumCsv` (T4/T5), `createBuybackAgreementPdf` (`@/lib/documents/buybackAgreementService`, SP3), `ISSUER` (`@/lib/documents/pdfUtils`).

- [ ] **Step 1: importy** — dodać na górze:
```ts
import { sendEmail } from '@/lib/mailer';
import { groupExpiringByOwner } from '@/lib/vouchers/expiryReminders';
import { buildElixir0, buildMillenniumCsv, type TransferItem } from '@/lib/bank/elixir0';
// (millennium re-uses TransferItem from elixir0)
import { createBuybackAgreementPdf } from '@/lib/documents/buybackAgreementService';
import { ISSUER } from '@/lib/documents/pdfUtils';
```
Uwaga: `buildMillenniumCsv` jest w osobnym pliku — dodać też `import { buildMillenniumCsv } from '@/lib/bank/millenniumCsv';`.

- [ ] **Step 2: SP4 — przypomnienia PRZED RPC** — po walidacji CRON_SECRET, przed `supabase.rpc(...)`, wstaw:
```ts
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
      const profById = new Map((profs ?? []).map((p: any) => [p.id, p]));
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
      // guard: oznacz jako przypomniane
      await supabase.from('vouchers').update({ expiry_reminder_at: new Date().toISOString() }).in('id', rows.map(r => r.id));
    }
  } catch (e: any) {
    console.error('[cron/expire-vouchers] przypomnienia:', e?.message);
  }
```

- [ ] **Step 3: SP5 — po RPC, przetwórz nowe odkupy** — po bloku ustawiającym `expired`/`buybacks` i przed `return`, wstaw. **`buyback_batches` jest PER-FIRMA** — kolumny (zweryfikowane w bazie): `id uuid, company_id uuid NOT NULL, created_by uuid?, period_label text?, total_amount numeric NOT NULL, voucher_count int NOT NULL, file_csv text?, status text NOT NULL CHECK IN ('generated','archived'), format text NOT NULL (bez CHECK), created_at`. Grupujemy pozycje po `company_id` i tworzymy 2 paczki (elixir0 + millennium) na firmę:
```ts
  // ── SP5: nowe umowy odkupu (bez pdf_url) — PDF + mail do pracownika + paczki przelewów per firma ──
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
        agg.items.push({
          recipientName: p.full_name ?? 'Pracownik',
          recipientIban: p.iban,
          amountPln: amount,
          title: `Odkup voucherów EBS ${String(agr.id).slice(-8).toUpperCase()}`,
        });
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
    // paczki per firma: elixir0 + millennium
    const sender = { name: ISSUER.name, iban: ISSUER.bank.replace(/\s+/g, '') };
    const now = new Date();
    const periodLabel = now.toISOString().slice(0, 7);
    const rid = () => Math.random().toString(36).slice(2, 8).toUpperCase();
    for (const [companyId, agg] of byCompany) {
      await supabase.from('buyback_batches').insert([
        { company_id: companyId, period_label: periodLabel, total_amount: agg.total, voucher_count: agg.count,
          status: 'generated', format: 'elixir0',    file_csv: buildElixir0(agg.items, sender, now) },
        { company_id: companyId, period_label: periodLabel, total_amount: agg.total, voucher_count: agg.count,
          status: 'generated', format: 'millennium', file_csv: buildMillenniumCsv(agg.items, sender, now) },
      ]);
    }
  } catch (e: any) {
    console.error('[cron/expire-vouchers] odkup:', e?.message);
  }
```
(`id`/`created_at` mają DEFAULT; `created_by` pomijamy = NULL — proces systemowy.)

- [ ] **Step 4: dołóż liczniki do odpowiedzi JSON** — w `return NextResponse.json({...})` dodaj `remindersSent, buybackEmails, batches: byCompany.size * 2`.

- [ ] **Step 5: typecheck + build** — `npx tsc --noEmit` → 0; `npm run build` → sukces.

- [ ] **Step 6: commit** `git add "app/api/cron/expire-vouchers/route.ts" && git commit -m "feat(cron): SP4 przypomnienia wygasniecia + SP5 odkup (PDF+mail+paczki Elixir-0/Millennium)"`

---

### Task 7: Env + dokumentacja + finalna weryfikacja

**Files:** Modify `CLAUDE.md`

- [ ] **Step 1: env** — dopisz w `CLAUDE.md` (sekcja env): potrzebne `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (domena `@stratton-prime.pl` potwierdzona w Resend) dla maili SP4/SP5; brak = wysyłka pomijana (log).
- [ ] **Step 2: opis** — dopisz krótką sekcję o przepływie wygaśnięcie→przypomnienie→odkup→paczki (cron `expire-vouchers`, `lib/mailer`, `lib/bank/*`, `buyback_agreements.pdf_url`, `buyback_batches` formaty `elixir0`/`millennium`). Zaznacz, że Elixir-0 wymaga weryfikacji w banku.
- [ ] **Step 3: pełna weryfikacja** — `npx vitest run` → zielone; `npx tsc --noEmit` → 0; `npm run build` → sukces.
- [ ] **Step 4: commit** `git add CLAUDE.md && git commit -m "docs: przypomnienia wygasniecia + odkup mail/Elixir-0/Millennium (SP4/SP5)"`

---

## Self-Review
- **Spec coverage:** SP4 = przypomnienie 1-dzień-przed mail+in-app [T2/T3/T6], `lib/mailer` [T1]. SP5 = mail do pracownika z umową [T6], paczki Elixir-0+Millennium [T4/T5/T6], PDF umowy [SP3, wołany w T6]. Bez nowego crona [T6 dokleja]. Pokryte.
- **Placeholder scan:** brak — cały kod podany; jedyne „zweryfikuj schemat `buyback_batches`" to celowa instrukcja walidacji, nie placeholder kodu.
- **Type consistency:** `TransferItem`/`SenderInfo` z `elixir0.ts` używane w `millenniumCsv.ts` i cronie; `sendEmail`/`groupExpiringByOwner`/`createBuybackAgreementPdf` sygnatury spójne.
- **Ryzyka:** Elixir-0 format do walidacji w banku (nota w kodzie). Cron może być czasochłonny przy dużej liczbie odkupów (PDF+mail w pętli) — akceptowalne przy obecnych wolumenach; przy skali rozważyć kolejkę (poza SP5).
