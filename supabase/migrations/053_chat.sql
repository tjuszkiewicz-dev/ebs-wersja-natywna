-- E6a: komunikator firmowy — schemat zdjęty INTROSPEKCJĄ z żywej bazy BBS-Unified
-- (information_schema.columns + pg_constraint + pg_indexes, 2026-09-03), nie z kodu.
-- Numer 053 czekał od E7a (dziura 052→054 była zamierzona).
--
-- Delty względem specu z 03.08 (odtwarzanego z kodu): doszły `chat_conversations.created_by`,
-- `chat_participants.joined_at`, `chat_messages.{duration_sec, translated_content, translated_lang}`,
-- a `kind` ma SZEŚĆ wartości, nie trzy. Dzięki temu E6b/E6c nie robią ALTER-ów na żywej
-- tabeli wiadomości — jedyna nowa tabela później to `meeting_notes` (E6c).
--
-- Adaptacje EBS względem BBS (spec E6 §3, K7–K9, K18):
--   * `chat_messages.sender_id` NULLOWALNY z FK ON DELETE SET NULL (w BBS NOT NULL bez FK).
--     Tryb PURGE z E5 fizycznie kasuje user_profiles — treść wiadomości zostaje jako historia
--     firmy, znika tylko powiązanie z osobą.
--   * FK do user_profiles na KAŻDEJ kolumnie użytkownika (precedens E7b, calendar_attendees):
--     w BBS ich nie ma, więc usunięcie konta zostawia sieroty. Purge kasuje jawnie (K5),
--     FK to siatka bezpieczeństwa.
--   * Audyt `fn_audit_log` TYLKO na chat_conversations i chat_participants. Na chat_messages
--     NIE — funkcja kopiuje to_jsonb(NEW), czyli treść prywatnych rozmów trafiałaby do
--     audit_log przy każdym wpisie (to samo ustalenie, które w E7d wymusiło własną funkcję
--     dla user_profiles). chat_reactions — wolumen, zerowa waga audytowa.
--   * `user_profiles.last_seen_at` — EBS jej nie miał; katalog liczy z niej status „online".
--   * Bucket `chat-media` (nazwa z kodu route'ów BBS; spec z 03.08 mylnie podawał chat-files).
--   * FK `calendar_events.conversation_id` → chat_conversations — obietnica z migracji 056.
--   * `chat_policy` BEZ seedów: w BBS tabela jest pusta, logika siedzi w lib/chat/policy.ts.
--
-- RLS: deny-all bez polityk, aplikacja chodzi na service_role (konwencja repo).

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =============================================================================
-- 1) chat_conversations — rozmowy (1:1 i grupy)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."chat_conversations" (
  "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
  "type"       text NOT NULL DEFAULT 'direct' CHECK (type IN ('direct','group')),
  "name"       text,
  "created_by" uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

-- =============================================================================
-- 2) chat_messages — wiadomości (tekst, głosówka, plik, obraz, systemowa, nagranie)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."chat_messages" (
  "id"                 uuid NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id"    uuid NOT NULL REFERENCES public."chat_conversations"(id) ON DELETE CASCADE,
  "sender_id"          uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  "kind"               text NOT NULL DEFAULT 'text'
                       CHECK (kind IN ('text','audio','file','image','system','recording')),
  "content"            text,
  "file_path"          text,
  "file_name"          text,
  "duration_sec"       numeric,
  "translated_content" text,
  "translated_lang"    text,
  "reply_to_id"        uuid REFERENCES public."chat_messages"(id) ON DELETE SET NULL,
  "edited_at"          timestamptz,
  "deleted_at"         timestamptz,
  "created_at"         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON public."chat_messages"(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to     ON public."chat_messages"(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_trgm ON public."chat_messages" USING gin (content gin_trgm_ops);

-- =============================================================================
-- 3) chat_participants — uczestnicy + ustawienia MOJE (odczyt, wyciszenie, przypięcie, archiwum)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."chat_participants" (
  "conversation_id" uuid NOT NULL REFERENCES public."chat_conversations"(id) ON DELETE CASCADE,
  "user_id"         uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  "joined_at"       timestamptz NOT NULL DEFAULT now(),
  "last_read_at"    timestamptz NOT NULL DEFAULT now(),
  "muted"           boolean NOT NULL DEFAULT false,
  "pinned"          boolean NOT NULL DEFAULT false,
  "archived"        boolean NOT NULL DEFAULT false,
  PRIMARY KEY ("conversation_id", "user_id")
);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public."chat_participants"(user_id);

-- =============================================================================
-- 4) chat_reactions — reakcje emoji (ta sama emoji drugi raz = zdjęcie reakcji)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."chat_reactions" (
  "message_id" uuid NOT NULL REFERENCES public."chat_messages"(id) ON DELETE CASCADE,
  "user_id"    uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  "emoji"      text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("message_id", "user_id", "emoji")
);
CREATE INDEX IF NOT EXISTS idx_chat_reactions_message ON public."chat_reactions"(message_id);

-- =============================================================================
-- 5) chat_policy — blokady par ról (brak wpisu = dozwolone; para posortowana alfabetycznie)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."chat_policy" (
  "id"      uuid NOT NULL DEFAULT gen_random_uuid(),
  "role_a"  text NOT NULL,
  "role_b"  text NOT NULL,
  "allowed" boolean NOT NULL DEFAULT true,
  PRIMARY KEY ("id"),
  UNIQUE ("role_a", "role_b")
);

-- =============================================================================
-- 6) chat_push_subscriptions — Web Push (tworzona teraz, używana od E6b)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public."chat_push_subscriptions" (
  "endpoint"   text NOT NULL,
  "user_id"    uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  "p256dh"     text NOT NULL,
  "auth"       text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("endpoint")
);
CREATE INDEX IF NOT EXISTS idx_chat_push_user ON public."chat_push_subscriptions"(user_id);

-- =============================================================================
-- 7) Obecność — heartbeat z otwartego komunikatora (online = ślad z ostatnich 3 minut)
-- =============================================================================
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS "last_seen_at" timestamptz;

-- =============================================================================
-- 8) calendar_events.conversation_id → FK (migracja 056 odłożyła go „do tabel czatu")
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'calendar_events_conversation_id_fkey') THEN
    ALTER TABLE public."calendar_events"
      ADD CONSTRAINT calendar_events_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public."chat_conversations"(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =============================================================================
-- 9) Storage — załączniki, głosówki, obrazy (prywatny; linki podpisywane na 1h)
-- =============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 10) Uprawnienie `komunikator.czat` dla ról WŁASNYCH (customized) spoza ról zewnętrznych.
--     Role z DEFAULT_ROLE_PERMS dostają klucz z rejestru w kodzie; role „customized"
--     czytają wyłącznie role_permissions, więc bez tego wpisu np. szef_koordynatorow
--     nie widziałby komunikatora. Idempotentne.
-- =============================================================================
INSERT INTO public.role_permissions (role, permission)
SELECT r.role, 'komunikator.czat'
FROM public.app_roles r
WHERE r.customized = true
  AND r.role NOT IN ('pracodawca', 'pracownik', 'superadmin')
  AND NOT EXISTS (
    SELECT 1 FROM public.role_permissions p WHERE p.role = r.role AND p.permission = 'komunikator.czat'
  );

-- =============================================================================
-- 11) RLS — deny-all
-- =============================================================================
ALTER TABLE public."chat_conversations"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."chat_messages"           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."chat_participants"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."chat_reactions"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."chat_policy"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."chat_push_subscriptions" ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 12) Audyt — TYLKO struktura rozmów (K9). chat_messages i chat_reactions świadomie bez triggera.
-- =============================================================================
DROP TRIGGER IF EXISTS trg_audit_chat_conversations ON public."chat_conversations";
CREATE TRIGGER trg_audit_chat_conversations
  AFTER INSERT OR UPDATE OR DELETE ON public."chat_conversations"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

DROP TRIGGER IF EXISTS trg_audit_chat_participants ON public."chat_participants";
CREATE TRIGGER trg_audit_chat_participants
  AFTER INSERT OR DELETE ON public."chat_participants"
  FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
