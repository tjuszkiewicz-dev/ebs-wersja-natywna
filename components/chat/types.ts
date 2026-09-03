// Typy kontraktu API komunikatora (E6a) — współdzielone przez hook `useChat` i komponenty.
// Kształty 1:1 z odpowiedzi app/api/chat/* (port z BBS) + `translated` (D7) i `role_label`.

export interface Member { id: string; full_name: string; role: string; role_label?: string }

export interface LastMessage { kind: string; content: string | null; sender_id: string | null; created_at: string }

export interface Conv {
  id: string; type: 'direct' | 'group'; name: string; members: Member[];
  last_message: LastMessage | null; unread: number; updated_at: string;
  muted?: boolean; pinned?: boolean; archived?: boolean;
}

export interface SearchHit { message_id: string; conversation_id: string; conversation_name: string; sender_name: string; content: string; created_at: string }
export interface ReplyRef { id: string; sender_name: string; preview: string | null }
export interface Reaction { emoji: string; count: number; mine: boolean }
export interface Translated { content: string; lang: string }

export interface Msg {
  id: string; sender_id: string | null; sender_name: string; kind: string; content: string | null;
  file_name?: string | null; duration_sec?: number | null; url?: string | null; created_at: string;
  deleted?: boolean; edited?: boolean; reply_to?: ReplyRef | null; reactions?: Reaction[];
  translated?: Translated | null;
}

export interface Contact { id: string; name: string; role: string; role_label?: string }

export interface Person {
  id: string; name: string; role: string; role_label: string;
  conversation_id: string | null; last_message: LastMessage | null; unread: number;
  online?: boolean; last_seen_at?: string | null;
  /** tylko pracownicy tymczasowi z katalogu koordynatora */
  employee_id?: string; language?: string | null;
}
