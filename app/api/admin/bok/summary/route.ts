// GET /api/admin/bok/summary — liczniki obu kolejek BOK (zamówienia + zapytania) per status.
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §11.
import { NextResponse } from 'next/server';
import { bokQueueGate, queueSummary } from '@/lib/benefits/bokQueueServer';

export async function GET() {
  const gate = await bokQueueGate();
  if (gate.res) return gate.res;
  try {
    return NextResponse.json(await queueSummary());
  } catch (e: any) {
    console.error('[bok-queue] summary failed', e?.message ?? e);
    return NextResponse.json({ error: 'Nie udało się policzyć zgłoszeń.' }, { status: 500 });
  }
}
