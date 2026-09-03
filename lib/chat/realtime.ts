// Powiadomienia Realtime dla komunikatora (serwer → klienci). Port 1:1 z BBS-Unified.
//
// Tabele czatu mają RLS deny-all (aplikacja chodzi na service_role), więc
// `postgres_changes` po stronie przeglądarki NIC nie zobaczy. Zamiast tego
// serwer po zapisie wysyła BROADCAST przez Realtime REST API na temat
// `user:{userId}` — każdy klient subskrybuje wyłącznie swój własny temat
// i po zdarzeniu dociąga dane zwykłym (autoryzowanym) API. (spec E6 K1)
//
// Best-effort: błąd sieci nie może wywrócić wysyłki wiadomości — klient ma
// nadal odpytywanie jako zapas.

export type ChatEventPayload = {
  type: 'message' | 'read' | 'update';   // nowa wiadomość | ktoś przeczytał | edycja/usunięcie/tłumaczenie
  conversation_id: string;
  from?: string;
};

export async function notifyChatUsers(userIds: string[], payload: ChatEventPayload): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const targets = [...new Set(userIds.filter(Boolean))];
  if (!url || !key || !targets.length) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: targets.map(uid => ({ topic: `user:${uid}`, event: 'chat', payload })),
      }),
    });
  } catch { /* powiadomienie jest dodatkiem — brak nie blokuje operacji */ }
}
