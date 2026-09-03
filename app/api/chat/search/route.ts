// GET /api/chat/search?q=fraza — wyszukiwanie w TREŚCI wiadomości, tylko w moich rozmowach.
// Zwraca trafienia z nazwą rozmowy i nadawcą, najnowsze pierwsze. Indeks: GIN pg_trgm (053).
// Port z BBS-Unified (E6a): bramka + 403, `sender_id` może być NULL (K7).
import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/supabaseAdmin';
import { profilesMap } from '@/lib/crm/profiles';
import { requireChatAuth } from '@/lib/chat/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIMIT = 30;

export async function GET(request: NextRequest) {
  const auth = await requireChatAuth();
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const sb = admin() as any;
  const { data: mine } = await sb.from('chat_participants').select('conversation_id').eq('user_id', auth.id);
  const convIds: string[] = (mine || []).map((m: any) => m.conversation_id);
  if (!convIds.length) return NextResponse.json({ results: [] });

  // %,_ w zapytaniu użytkownika trzeba wyescapować, żeby nie zmieniały wzorca LIKE
  const safe = q.replace(/[%_\\]/g, s => `\\${s}`);
  const { data: msgs, error } = await sb.from('chat_messages')
    .select('id, conversation_id, sender_id, content, created_at')
    .in('conversation_id', convIds)
    .eq('kind', 'text')
    .is('deleted_at', null)
    .ilike('content', `%${safe}%`)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const hitConvIds = [...new Set((msgs || []).map((m: any) => m.conversation_id as string))];
  const [{ data: convs }, { data: parts }] = await Promise.all([
    sb.from('chat_conversations').select('id, type, name').in('id', hitConvIds),
    sb.from('chat_participants').select('conversation_id, user_id').in('conversation_id', hitConvIds),
  ]);
  const profiles = await profilesMap([
    ...(msgs || []).map((m: any) => m.sender_id), ...(parts || []).map((p: any) => p.user_id),
  ]);
  const convName = new Map<string, string>();
  for (const c of convs || []) {
    if (c.type === 'group') convName.set(c.id, c.name || 'Grupa');
    else {
      const other = (parts || []).find((p: any) => p.conversation_id === c.id && p.user_id !== auth.id);
      convName.set(c.id, profiles.get(other?.user_id)?.full_name || '—');
    }
  }

  const results = (msgs || []).map((m: any) => ({
    message_id: m.id,
    conversation_id: m.conversation_id,
    conversation_name: convName.get(m.conversation_id) || '—',
    sender_name: m.sender_id ? (profiles.get(m.sender_id)?.full_name || '—') : 'Konto usunięte',
    content: String(m.content || '').slice(0, 160),
    created_at: m.created_at,
  }));
  return NextResponse.json({ results });
}
