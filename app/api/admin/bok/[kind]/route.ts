// GET /api/admin/bok/{orders|inquiries}?status=open|new|in_progress|done|all&limit&offset
// Kolejka zgłoszeń BOK: zamówienia ze sklepu (pochodna księgi) i zapytania o ofertę.
// Spec: docs/superpowers/specs/2026-09-15-sklep-benefitow-design.md §11.
import { NextRequest, NextResponse } from 'next/server';
import { isQueueKind } from '@/lib/benefits/bokQueue';
import { bokQueueGate, listQueue } from '@/lib/benefits/bokQueueServer';

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const gate = await bokQueueGate();
  if (gate.res) return gate.res;
  const { kind } = await params;
  if (!isQueueKind(kind)) return NextResponse.json({ error: 'Nieznany rodzaj kolejki.' }, { status: 404 });
  try {
    return NextResponse.json(await listQueue(kind, req.nextUrl.searchParams));
  } catch (e: any) {
    console.error('[bok-queue] list failed', { kind, error: e?.message ?? e });
    return NextResponse.json({ error: 'Nie udało się pobrać zgłoszeń.' }, { status: 500 });
  }
}
