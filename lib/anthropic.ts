// Singleton klienta Anthropic + stała modelu (wcześniej `new Anthropic(...)`
// i 'claude-opus-4-8' zaszyte na sztywno w 8 plikach — zmiana modelu = 8 edycji).
//
// Od 28.10.2026 każde wywołanie melduje model, funkcję i tokeny do tablicy „Zużycie”
// w Hubie Strattona (zegar EBS; koszt liczy Hub z cennika). Bez HUB_ZUZYCIE_KLUCZ — nic.
// `getAnthropic('notatki')` — nazwa funkcji trafia na zegar; bez niej „inne”.
import Anthropic from '@anthropic-ai/sdk';
import { after } from 'next/server';

export const AI_MODEL = process.env.AI_MODEL || 'claude-opus-4-8';

const HUB = process.env.HUB_ZUZYCIE_URL || 'https://stratton-hub-panel.vercel.app';

/** Meldunek do Huba. Best-effort — awaria Huba nie może zatrzymać wywołania AI. */
export function meldujZuzycie(p: { dostawca: string; funkcja: string; model: string; we: number; wy: number; kosztUsd?: number }): void {
  const klucz = process.env.HUB_ZUZYCIE_KLUCZ;
  if (!klucz) return;
  const wyslij = () => fetch(`${HUB}/api/hub/zuzycie/meldunek`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${klucz}` },
    body: JSON.stringify({ pozycje: [{ ...p, wywolania: 1 }] }),
    signal: AbortSignal.timeout(8000),
  }).then(undefined, () => undefined);
  // after() trzyma funkcję Vercela przy życiu do końca meldunku; poza żądaniem rzuca — wtedy zwykłe wysłanie.
  try { after(wyslij); } catch { void wyslij(); }
}

const klienci = new Map<string, Anthropic>();

export const getAnthropic = (funkcja = 'inne'): Anthropic => {
  const gotowy = klienci.get(funkcja);
  if (gotowy) return gotowy;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages = client.messages as unknown as { create: (...args: unknown[]) => Promise<unknown> };
  const oryginalneCreate = messages.create.bind(client.messages);
  messages.create = async (...args: unknown[]) => {
    const resp = await oryginalneCreate(...args);
    const r = resp as { model?: string; usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null } } | null;
    const u = r?.usage;
    // Wejście jako równoważnik ceny wejścia: zapis cache ×1,25, odczyt ×0,1 (cennik Anthropic).
    const we = Math.round((u?.input_tokens ?? 0) + 1.25 * (u?.cache_creation_input_tokens ?? 0) + 0.1 * (u?.cache_read_input_tokens ?? 0));
    meldujZuzycie({ dostawca: 'anthropic', funkcja, model: r?.model ?? (args[0] as { model?: string } | undefined)?.model ?? '', we, wy: u?.output_tokens ?? 0 });
    return resp;
  };
  klienci.set(funkcja, client);
  return client;
};
