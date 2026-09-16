// PATCH /api/admin/bok/{orders|inquiries}/{id} — zmiana statusu i/lub notatki BOK.
// Body: { status?: 'new'|'in_progress'|'done', note?: string|null } — co najmniej jedno pole.
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §11.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { NOTE_MAX, QUEUE_STATUSES, isQueueKind } from '@/lib/benefits/bokQueue';
import { bokQueueGate, patchQueueRow } from '@/lib/benefits/bokQueueServer';

const Schema = z.object({
  status: z.enum(QUEUE_STATUSES as unknown as [string, ...string[]]).optional(),
  note: z.string().max(NOTE_MAX, `Notatka może mieć najwyżej ${NOTE_MAX} znaków.`).nullable().optional(),
}).refine(b => b.status !== undefined || b.note !== undefined, { message: 'Podaj status albo notatkę.' });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const gate = await bokQueueGate();
  if (gate.res) return gate.res;
  const { kind, id } = await params;
  if (!isQueueKind(kind)) return NextResponse.json({ error: 'Nieznany rodzaj kolejki.' }, { status: 404 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Nieprawidłowy identyfikator.' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Nieprawidłowe dane.' }, { status: 400 });

  try {
    const row = await patchQueueRow(kind, id, parsed.data as { status?: 'new' | 'in_progress' | 'done'; note?: string | null }, gate.auth.id);
    if (!row) return NextResponse.json({ error: 'Zgłoszenie nie istnieje.' }, { status: 404 });
    return NextResponse.json({ ok: true, row });
  } catch (e: any) {
    console.error('[bok-queue] patch failed', { kind, id, error: e?.message ?? e });
    return NextResponse.json({ error: 'Nie udało się zapisać zmiany.' }, { status: 500 });
  }
}
